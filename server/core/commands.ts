import { VirtualPlayerHolder } from './player.ts';
import { Group, Server } from './server.ts';
import { Command, HelpPage, Holder } from './types.ts';

export function setupCommands(server: Server, _commands: Holder<Command>) {
	server.addCommand({
		name: 'help',
		description: 'Contains list of all commands',
		help: [
			{
				title: '/help command',
				number: 0,
				lines: [
					'This command displays list of commands available on server',
					'or information about selected one.',
					'Usage: &6/help <command> [<page>] &aor &6/help <command> [<page>]',
				],
			},
		],

		execute: (ctx) => {
			const invalidUsage = '&cInvalid arguments! Usage: &6/help [<command>] [<page>] &aor &6[<page>]';

			const args = ctx.command.split(' ');
			let page = 0;
			let size = 0;
			let command = '';
			try {
				if (args.length == 1) {
					page = 0;
				} else if (args.length == 2) {
					page = parseInt(args[1]) - 1;

					if (isNaN(page)) {
						command = args[1];
						page = 0;
					}
				} else if (args.length == 3) {
					command = args[1];
					page = parseInt(args[2]) - 1;
				} else {
					throw null;
				}

				if (page < 0 || isNaN(page)) {
					page = 0;
				}

				try {
					let helpPage: HelpPage | undefined;

					if (command.length == 0) {
						const commands = Object.values(_commands);
						size = Math.ceil(commands.length / 8);

						const lines: string[] = [];

						if (page >= size) {
							page = 0;
						}

						let x = 0;
						let i = 0;
						while (true) {
							const cmd = commands[x + page * 8];
							x += 1;

							if (cmd?.permission && !ctx.checkPermission(cmd.permission)) {
								continue;
							}

							i += 1;

							if (cmd != undefined) {
								lines.push(`&6/${cmd.name} &7- ${cmd.description ?? 'A command'}`);
							}

							if (i >= 8) {
								break;
							}
						}

						helpPage = {
							number: page,
							title: 'Commands',
							lines: lines,
						};
					} else {
						const pages = _commands[command].help ?? [];
						size = pages.length;

						if (size == 0) {
							return;
						}

						if (page >= size) {
							page = 0;
						}

						helpPage = pages[page] ?? pages[0];
					}

					if (helpPage) {
						ctx.send(`&8- &3Help: &6${helpPage.title}`);
						helpPage.lines.forEach(ctx.send);
						ctx.send(`&8[&aPage &b${page + 1}&a out of &b${size}&a pages&8]`);
					} else {
						ctx.send(`&cThis help page doesn't exist!`);
					}
				} catch (e) {
					server.logger.error(`${ctx.player?.username ?? 'Console'} tried to excute ${ctx.command} and it failed!`);
					server.logger.error(e);
					ctx.send('&cError occured while executing this command.');
				}
			} catch {
				ctx.send(invalidUsage);
				return;
			}
		},
	});

	server.addCommand({
		name: 'spawn',
		description: 'Teleports player to spawn (of world)',
		permission: 'commands.spawn',
		help: [
			{
				title: '/spawn command',
				number: 0,
				lines: ['Teleports player to spawnpoint of a world', 'Usage: &6/spawn [<username>]'],
			},
		],

		execute: (ctx) => {
			const args = ctx.command.split(' ');

			if (args.length == 1 && ctx.player) {
				const world = ctx.player.world;
				ctx.player.teleport(world, world.spawnPoint[0], world.spawnPoint[1], world.spawnPoint[2], world.spawnPointYaw, world.spawnPointPitch);

				ctx.send('&aTeleported to spawn!');
			} else if (args.length == 2 && ctx.player) {
				const world = server.worlds[args[1]];
				if (world) {
					ctx.player.changeWorld(world);
					ctx.send(`&aTeleported to spawn of ${world.name}!`);
				} else {
					ctx.send(`&cWorld ${args[1]} doesn't exist!`);
				}
			} else if (args.length == 3 && ctx.checkPermission('commands.spawn.teleportother')) {
				const world = server.worlds[args[1]];
				const player = server.players[server.getPlayerIdFromName(args[2]) ?? ''] ?? null;

				if (world && player) {
					player.teleport(world, world.spawnPoint[0], world.spawnPoint[1], world.spawnPoint[2], world.spawnPointYaw, world.spawnPointPitch);
					ctx.send(`&aTeleported ${player.getDisplayName()} to spawn of ${world.name}!`);
				} else {
					ctx.send(`&cInvalid world or player`);
				}
			} else {
				ctx.send('&cInvalid arguments! Usage: &6/spawn [<world>]');
			}
		},
	});

	server.addCommand({
		name: 'main',
		description: 'Teleports to main world',
		permission: 'commands.main',
		help: [
			{
				title: '/main command',
				number: 0,
				lines: ['Teleports player to main world.', 'Usage: &6/main [<username>]'],
			},
		],

		execute: (ctx) => {
			const args = ctx.command.split(' ');

			if (args.length == 1 && ctx.player) {
				const world = server.worlds[server.config.defaultWorldName];
				ctx.player.teleport(world, world.spawnPoint[0], world.spawnPoint[1], world.spawnPoint[2], world.spawnPointYaw, world.spawnPointPitch);

				ctx.send('&aTeleported to main world!');
			} else if (args.length == 2 && ctx.checkPermission('commands.main.teleportother')) {
				const world = server.worlds[server.config.defaultWorldName];
				const player = server.players[server.getPlayerIdFromName(args[2]) ?? ''] ?? null;

				if (player) {
					player.changeWorld(world);
					ctx.send(`&aTeleported ${player.getDisplayName()} to main world!`);
				} else {
					ctx.send(`&cPlayer ${args[1]} doesn't exist!`);
				}
			} else {
				ctx.send('&cInvalid arguments! Usage: &6/spawn [<username>]');
			}
		},
	});

	server.addCommand({
		name: 'perms',
		description: 'Allows to modify permissions',
		permission: 'commands.perms',
		help: [
			{
				title: '/perms command',
				number: 0,
				lines: [
					'This commands allows to manage permissions and groups',
					'of players.',
					'&6/perms player [<user>] set [<perm>] <true/false> &7-',
					'&7 Sets permission of player',
					'&6/perms player [<user>] remove [<perm>] &7-',
					"&7 Removes player's permission",
					'&6/perms player [<user>] groupadd [<group>] &7-',
					'&7 Adds player to a group',
					'&6/perms player [<user>] groupremove [<group>] &7-',
					'&7 Removes player from a group',
				],
			},
			{
				title: '/perms command',
				number: 1,
				lines: [
					'&6/perms group [<group>] set [<perm>] <true/false> &7-',
					'&7 Sets permission of group',
					'&6/perms group [<group>] remove [<perm>] &7-',
					"&7 Removes group's permission",
					'&6/perms group [<group>] prefix <prefix> &7-',
					'&7 Changes groups prefix',
					'&6/perms group [<group>] suffix <prefix> &7-',
					'&7 Changes groups suffix',
					'&6/perms group [<group>] name <visible name> &7-',
					'&7 Changes visible name of a group',
				],
			},
		],

		execute: (ctx) => {
			const args = ctx.command.split(' ');

			try {
				if (args.length >= 4) {
					switch (args[1]) {
						case 'user':
						case 'player':
							{
								const uuid = server.getPlayerIdFromName(args[2]);
								if (!uuid) throw 'p';
								const player = new VirtualPlayerHolder(uuid, server);
								let tmp = false;

								switch (args[3]) {
									case 'add':
									case 'set':
										tmp = ('' + args[4]).toLowerCase() != 'false';
										player.setPermission(args[4], tmp);
										ctx.send(`&aChanged permission &6${args[4]}&a of &f${player.getName()}&a to &6${tmp}&a.`);
										break;
									case 'remove':
										player.setPermission(args[4], null);
										ctx.send(`&aRemoved permission &6${args[4]}&a from &f${player.getName()}&a.`);
										break;
									case 'groupadd':
										player.addGroup(args[4]);
										ctx.send(`&aAdded &f${player.getName()}&a to group &f${args[4]}&a.`);
										break;
									case 'groupremove':
										player.removeGroup(args[4]);
										ctx.send(`&aRemoved &f${player.getName()}&a from group &f${args[4]}&a.`);
										break;
									default:
										throw 'ia';
								}

								player.finish();
							}
							break;
						case 'group':
							{
								let group = server.groups[args[2]];
								let tmp = false;
								if (!group) {
									group = new Group({ name: args[2], permissions: {} });
									server.groups[args[2]] = group;
								}

								switch (args[2]) {
									case 'set':
										tmp = ('' + args[4]).toLowerCase() != 'false';
										group.setPermission(args[4], tmp);
										ctx.send(`&aChanged permission &6${args[3]}&a of group &f${group.getName()}&a to &6${tmp}.`);
										break;
									case 'remove':
										group.setPermission(args[4], null);
										ctx.send(`&aRemoved permission &6${args[3]}&a from group &f${group.getName()}&a.`);
										break;
									case 'prefix':
										group.prefix = args[4] ?? '';
										ctx.send(`&aChanged prefix of &f${group.getName()}&a to &f${args[4] ?? '<EMPTY>'}&a.`);
										break;
									case 'suffix':
										group.sufix = args[4] ?? '';
										ctx.send(`&aChanged suffix of &f${group.getName()}&a to &f${args[4] ?? '<EMPTY>'}&a.`);
										break;
									case 'name':
										group.visibleName = args[4] ?? undefined;
										ctx.send(`&aChanged display name of &f${group.name}&a to &f${group.visibleName ?? group.name}}&a.`);
										break;
									default:
										throw 'ia';
								}
							}
							break;
						default:
							throw 'ia';
					}
				} else {
					throw 'ia';
				}
			} catch (e) {
				if (e == 'ia') {
					ctx.send('&cInvalid arguments! Check /help perms!');
				} else if (e == 'p' || e == 'No player!') {
					ctx.send('&cInvalid player!');
				}
			}
		},
	});

	/* Template

	server.addCommand({
		name: '',
		description: '',
		help: [
			{
				title: '',
				number: 0,
				lines: [
					
				],
			},
		],

		execute: (ctx) => {
		
		}
	});
	*/
}