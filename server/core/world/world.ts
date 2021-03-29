import type { Player } from '../player.ts';
import type { Server } from '../server.ts';
import type { Holder, Nullable, Services, XYZ } from '../types.ts';

import { Byte, decode as decodeNBT, encode as encodeNBT, Short, Tag, TagObject } from '../../libs/nbt/index.ts';

import { uuid } from '../deps.ts';
import { blocks, Block, blocksIdsToName } from './blocks.ts';

export class World {
	readonly blockData: Uint8Array;

	readonly size: [number, number, number];
	readonly uuid: string;
	readonly fileName: string;
	readonly players: Player[] = [];

	name: string;

	spawnPoint: [number, number, number];
	spawnPointPitch: number;
	spawnPointYaw: number;

	readonly timeCreated: bigint;
	readonly createdBy: {
		service: Services;
		username: string;
	};

	readonly generator: {
		readonly software: string;
		readonly type: string;
	};

	lastModified: bigint;

	_metadata: Tag;
	readonly _server: Server;

	constructor(fileName: string, data: WorldData, server: Server) {
		this._server = server;

		this.fileName = fileName;
		this.uuid = data.uuid ?? uuid.v4();
		this.name = data.name ?? fileName;
		const size = data.size[0] * data.size[1] * data.size[2];

		this.blockData = data.blockData ?? new Uint8Array(4 + size);

		new DataView(this.blockData.buffer).setInt32(0, size);

		this.size = data.size;

		this.spawnPoint = data.spawnPoint;
		this.spawnPointPitch = data.spawnPointPitch ?? 0;
		this.spawnPointYaw = data.spawnPointYaw ?? 0;

		this.timeCreated = data.timeCreated ?? BigInt(Date.now());
		this.generator = data.generator;
		this.createdBy = data.createdBy ?? { service: 'Unknown', username: server.softwareName };

		this.lastModified = data.lastModified ?? BigInt(Date.now());

		this._metadata = data._metadata ?? {};
	}

	setBlock(x: number, y: number, z: number, block: number): boolean {
		if (this.isInBounds(x, y, z)) {
			this.rawSetBlock(x, y, z, block);
			this.players.forEach((p) => p._connectionHandler.setBlock(x, y, z, block));
			return true;
		} else {
			return false;
		}
	}

	rawSetBlock(x: number, y: number, z: number, block: number) {
		this.blockData[4 + x + this.size[0] * (z + this.size[2] * y)] = block;
	}

	getBlock(x: number, y: number, z: number): number {
		return this.isInBounds(x, y, z) ? this.blockData[4 + x + this.size[0] * (z + this.size[2] * y)] : 0;
	}

	isInBounds(x: number, y: number, z: number): boolean {
		return x >= 0 && y >= 0 && z >= 0 && x < this.size[0] && y < this.size[1] && z < this.size[2];
	}

	save() {
		this._server.saveWorld(this);
	}

	getHighestBlock(x: number, z: number, nonSolid = false): number {
		for (let y = this.size[1] - 1; y > 0; y--) {
			const block = this.getBlock(x, y, z);
			if ((nonSolid && block != 0) || (<Holder<Block>>blocks)[blocksIdsToName[block]].solid) {
				return y;
			}
		}

		return 0;
	}

	_addPlayer(player: Player) {
		this.players.push(player);

		this.players.forEach((p) => p._connectionHandler.sendSpawnPlayer(player));
	}

	_removePlayer(player: Player) {
		const x = this.players.indexOf(player);

		if (x != -1) {
			this.players.splice(x);
		}

		this.players.forEach((p) => p._connectionHandler.sendDespawnPlayer(player));
	}

	_movePlayer(player: Player, pos: XYZ, yaw: number, pitch: number) {
		this.players.forEach((p) => (p == player ? null : p._connectionHandler.sendMove(player, pos, yaw, pitch)));
	}

	serialize(): Uint8Array {
		return encodeNBT('ClassicWorld', {
			FormatVersion: new Byte(1),
			Name: this.name,
			UUID: uuid.parse(this.uuid),
			X: new Short(this.size[0]),
			Y: new Short(this.size[1]),
			Z: new Short(this.size[2]),
			Spawn: {
				X: new Short(Math.floor(this.spawnPoint[0] * 32)),
				Y: new Short(Math.floor(this.spawnPoint[1] * 32)),
				Z: new Short(Math.floor(this.spawnPoint[2] * 32)),
				H: new Byte(this.spawnPointYaw),
				P: new Byte(this.spawnPointPitch),
			},
			BlockArray: this.blockData.slice(4, this.blockData.length),
			Metadata: this._metadata,
			TimeCreated: this.timeCreated,
			LastModified: this.lastModified,
			CreatedBy: {
				Service: this.createdBy.service,
				Username: this.createdBy.username,
			},
			MapGenerator: {
				Software: this.generator.software,
				MapGeneratorName: this.generator.type,
			},
		});
	}

	static deserialize(data: Uint8Array): Nullable<WorldData> {
		try {
			const decoded = decodeNBT(data);

			const main = <TagObject>decoded.value;

			const id = uuid.stringify(<Uint8Array>main.UUID);
			const blocks = <Uint8Array>main.BlockArray;
			const blocks2 = <Uint8Array | undefined>main.BlockArray2;

			const spawn = <{ [i: string]: { value: number } }>main.Spawn;
			const createdBy = <{ Service?: Services; Username: string }>main.CreatedBy;
			const generator = <{ Software?: string; MapGeneratorName: string }>main.MapGenerator;

			const blockData = new Uint8Array(4 + blocks.length);
			const view = new DataView(blockData.buffer, blockData.byteOffset, blockData.byteLength);

			const metadata = <TagObject>main?.Metadata ?? {};

			view.setUint32(0, blocks.length);

			const fallback: Uint8Array | undefined = <Uint8Array>(<TagObject>(<TagObject>metadata.CPE)?.CustomBlocks)?.Fallback;

			const getBlockAt =
				blocks2 != undefined
					? (x: number) => {
							return blocks[x] | (blocks2[x] << 8);
						}
					: (x: number) => blocks[x];

			if (fallback != undefined) {
				for (let x = 0; x < blocks.length; x++) {
					view.setUint8(4 + x, fallback[getBlockAt(x)] ?? 0);
				}
			} else {
				blockData.set(blocks, 4);
			}

			return {
				uuid: id,
				name: main?.Name as string,
				blockData: blockData,
				size: [(<Short>main.X).value, (<Short>main.Y).value, (<Short>main.Z).value],
				spawnPoint: [spawn.X.value / 32, spawn.Y.value / 32, spawn.Z.value / 32],
				spawnPointYaw: spawn.H.value,
				spawnPointPitch: spawn.P.value,
				createdBy: {
					service: createdBy?.Service ?? 'Unknown',
					username: createdBy?.Username ?? 'Unknown',
				},
				timeCreated: <bigint>main?.TimeCreated ?? Date.now(),
				lastModified: <bigint>main?.LastModified ?? Date.now(),
				generator: {
					software: generator?.Software ?? 'Unknown',
					type: generator?.MapGeneratorName ?? 'Unknown',
				},

				_metadata: metadata,
			};
		} catch (e) {
			return null;
		}
	}
}

export interface WorldGenerator {
	name: string;
	generate: (world: World, seed?: number) => void;
}

export interface WorldData {
	size: [number, number, number];
	name?: string;
	uuid?: string;
	blockData?: Uint8Array;
	createdBy?: {
		service: Services;
		username: string;
	};

	generator: {
		software: string;
		type: string;
	};

	timeCreated?: bigint;
	lastModified?: bigint;

	_metadata?: Tag;

	spawnPoint: [number, number, number];
	spawnPointPitch?: number;
	spawnPointYaw?: number;
}