const textDecoder = new TextDecoder('us-ascii');
const textEncoder = new TextEncoder();

export const classicTextRegex = /[^ -~]/gi;

export class ClassicPacketReader {
	buffer: Uint8Array;
	view: DataView;
	pos: number;

	constructor(buffer: Uint8Array) {
		this.buffer = buffer;
		this.view = new DataView(buffer.buffer);
		this.pos = 0;
	}

	readByte(): number {
		const x = this.buffer[this.pos];
		this.pos += 1;
		return x;
	}

	readShort(): number {
		const x = this.view.getInt16(this.pos);
		this.pos += 2;
		return x;
	}

	readSByte(): number {
		const x = this.view.getInt8(this.pos);
		this.pos += 1;
		return x;
	}

	readString(): string {
		const x = this.buffer.subarray(this.pos, this.pos + 64);
		this.pos += 64;
		return textDecoder.decode(x).trimEnd();
	}

	readByteArray(): Uint8Array {
		const x = this.buffer.subarray(this.pos, this.pos + 1024);
		this.pos += 1024;
		return x;
	}

	isFinished(): boolean {
		return this.pos >= this.buffer.length;
	}

	resetPos(): void {
		this.pos = 0;
	}
}

export class ClassicPacketWriter {
	buffer: Uint8Array;
	view: DataView;
	pos: number;

	constructor(lenght: number = 4096) {
		this.buffer = new Uint8Array(lenght);
		this.view = new DataView(this.buffer.buffer);
		this.pos = 0;
	}

	writeByte(n: number) {
		this.buffer[this.pos] = n;
		this.pos += 1;
		return this;
	}

	writeShort(n: number) {
		this.view.setInt16(this.pos, n);
		this.pos += 2;
		return this;
	}

	writeSByte(n: number) {
		this.view.setInt8(this.pos, n);
		this.pos += 1;
		return this;
	}

	writeString(n: string) {
		const b = textEncoder.encode(n.replaceAll(classicTextRegex, '_'));

		for (let x = 0; x < 64; x++) {
			this.buffer[this.pos + x] = b[x] ?? 0x20;
		}
		this.pos += 64;
		return this;
	}

	writeByteArray(n: Uint8Array) {
		for (let x = 0; x < 1024; x++) {
			this.buffer[this.pos + x] = n[x];
		}
		this.pos += 1024;
		return this;
	}


	toPacket() {
		return this.buffer.subarray(0, this.pos)
	}
}
