const audioContext = new (window.AudioContext || window.webkitAudioContext)();

let numMeasures = document.getElementById("numMeasures").value;
document.getElementById("numMeasures").addEventListener("input", () => {
	numMeasures = document.getElementById("numMeasures").value;
	if (numMeasures <= 1) numMeasures = 2;
	else if (numMeasures > 16) numMeasures = 16;
});

let globalSequence = [];

// Dice Roll Tables from Mozart's Musical Dice Game
const MINUET_TABLE = [
	[96, 32, 69, 40, 148, 104, 152, 119, 98, 3, 54],
	[22, 6, 95, 17, 74, 157, 60, 84, 142, 87, 130],
	[141, 128, 158, 113, 163, 27, 171, 114, 42, 165, 10],
	[41, 63, 13, 85, 45, 167, 53, 50, 156, 61, 103],
	[105, 146, 153, 161, 80, 154, 99, 140, 75, 135, 28],
	[122, 46, 55, 2, 97, 68, 133, 86, 129, 47, 37],
	[11, 134, 110, 159, 36, 118, 21, 169, 62, 147, 106],
	[30, 81, 24, 100, 107, 91, 127, 94, 123, 33, 5],
	[70, 117, 66, 90, 25, 138, 16, 120, 65, 102, 35],
	[121, 39, 139, 176, 143, 71, 155, 88, 77, 4, 20],
	[26, 126, 15, 7, 64, 150, 57, 48, 19, 31, 108],
	[9, 56, 132, 34, 125, 29, 175, 166, 82, 164, 92],
	[112, 174, 73, 67, 76, 101, 43, 51, 137, 144, 12],
	[49, 18, 58, 160, 136, 162, 168, 145, 52, 1, 109],
	[116, 23, 79, 172, 89, 149, 131, 95, 115, 44, 173]
];

const TRIO_TABLE = [
	[72, 56, 75, 40, 83, 18], [6, 82, 39, 73, 3, 45],
	[59, 42, 54, 16, 28, 62], [25, 74, 1, 68, 53, 38],
	[81, 14, 65, 29, 37, 4], [41, 7, 43, 55, 17, 27],
	[89, 26, 15, 2, 44, 52], [13, 71, 80, 61, 70, 94],
	[36, 76, 9, 22, 63, 11], [5, 20, 34, 67, 85, 92],
	[46, 64, 93, 49, 32, 24], [79, 84, 48, 77, 96, 86],
	[30, 8, 69, 57, 12, 51], [95, 35, 50, 87, 23, 60],
	[90, 21, 10, 91, 47, 19], [78, 88, 31, 66, 58, 33]
];

// Roll a pair of dice (sum ranges from 2 to 12)
function rollDice() {
	return Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1;
}

// Generate a random Minuet sequence
function generateMinuet() {
	let sequence = [];

	for (let i = 0; i < numMeasures - 1; i++) {
		let diceRoll = rollDice();
		let measureNumber = MINUET_TABLE[i][diceRoll - 2]; 
		sequence.push(`segment/M${measureNumber}.wav`);

		// 5% chance to repeat the previous measure
		if (Math.random() < 0.05) {
			sequence.push(sequence[sequence.length - 1]);
		} else {
			sequence.push(`segment/M${measureNumber}.wav`);
		}
	}

	return sequence;
}

// Generate a random Trio sequence
function generateTrio() {
	let sequence = [];

	for (let i = 0; i < numMeasures - 1; i++) {
		let diceRoll = rollDice() % 6; // TODO: Check if this is correct
		let measureNumber = TRIO_TABLE[i][diceRoll];
		sequence.push(`segment/T${measureNumber}.wav`);
	}

	return sequence;
}

// Fetch and decode audio file
function fetchAndDecodeAudio(url) {
	return fetch(url)
		.then(response => {
			if (!response.ok) throw new Error(`Failed to load ${url}`);
			return response.arrayBuffer();
		})
		.then(arrayBuffer => audioContext.decodeAudioData(arrayBuffer))
		.catch(error => console.error("Error decoding", url, error));
}

// Merge audio buffers
function mergeAudioBuffers(buffers) {
	let totalDuration = buffers.reduce((sum, buffer) => sum + buffer.duration, 0);
	let outputBuffer = audioContext.createBuffer(
		2, // Stereo
		totalDuration * audioContext.sampleRate,
		audioContext.sampleRate
	);

	let offset = 0;
	buffers.forEach(buffer => {
		for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
			let outputData = outputBuffer.getChannelData(channel);
			let inputData = buffer.getChannelData(channel);
			// TODO: Fix error where the line of code below says something about too large of a buffer
			// Uncaught (in promise) RangeError: source array is too long
			outputData.set(inputData, offset);
		}
		offset += buffer.length;
	});

	return outputBuffer;
}

// Generate the waltz
function generateWaltz() {
	let sequence = [...generateMinuet(), ...generateTrio()];
	sequence = sequence.sort(() => Math.random() - 0.5);

	Promise.all(sequence.map(fetchAndDecodeAudio)).then(buffers => {
		let mergedBuffer = mergeAudioBuffers(buffers);
		playMergedAudio(mergedBuffer);
	});

	globalSequence = sequence;
}

// Play the merged audio
function playMergedAudio(buffer) {
	let offlineContext = new OfflineAudioContext(
		2, // Stereo
		buffer.length,
		audioContext.sampleRate
	);

	let bufferSource = offlineContext.createBufferSource();
	bufferSource.buffer = buffer;
	bufferSource.connect(offlineContext.destination);
	bufferSource.start();

	offlineContext.startRendering().then(renderedBuffer => {
		let audioBlob = bufferToWave(renderedBuffer);
		let audioURL = URL.createObjectURL(audioBlob);
		document.getElementById("player").playbackRate = Math.random() * 0.5 + 0.75;
		document.getElementById("player").src = audioURL;
		document.getElementById("player").play();
	});
}

// Convert buffer to WAV file
function bufferToWave(buffer) {
	let numberOfChannels = buffer.numberOfChannels;
	let length = buffer.length * numberOfChannels * 2 + 44;
	let bufferArray = new ArrayBuffer(length);
	let view = new DataView(bufferArray);
	let channels = [];
	let offset = 44;
	let sampleRate = buffer.sampleRate;

	writeString(view, 0, 'RIFF');
	view.setUint32(4, 36 + buffer.length * numberOfChannels * 2, true);
	writeString(view, 8, 'WAVE');
	writeString(view, 12, 'fmt ');
	view.setUint32(16, 16, true);
	view.setUint16(20, 1, true);
	view.setUint16(22, numberOfChannels, true);
	view.setUint32(24, sampleRate, true);
	view.setUint32(28, sampleRate * numberOfChannels * 2, true);
	view.setUint16(32, numberOfChannels * 2, true);
	view.setUint16(34, 16, true);
	writeString(view, 36, 'data');
	view.setUint32(40, buffer.length * numberOfChannels * 2, true);

	for (let i = 0; i < numberOfChannels; i++) {
		channels.push(buffer.getChannelData(i));
	}

	for (let i = 0; i < buffer.length; i++) {
		for (let channel = 0; channel < numberOfChannels; channel++) {
			let sample = Math.max(-1, Math.min(1, channels[channel][i]));
			view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
			offset += 2;
		}
	}

	return new Blob([bufferArray], { type: 'audio/wav' });
}

// Write string to DataView
function writeString(view, offset, string) {
	for (let i = 0; i < string.length; i++) {
		view.setUint8(offset + i, string.charCodeAt(i));
	}
}

// Function to take in the sequence and then output a filename unique to that specific sequence by using the least amount of characters possible
function generateFilename(sequence) {
	let segments = {};
	sequence.forEach(segment => segments[segment] = true);

	let segmentMap = {};
	sequence.forEach((segment, index) => segmentMap[segment] = index);

	let filename = "";
	sequence.forEach(segment => filename += String.fromCharCode(65 + segmentMap[segment]));

	return filename;
}

// Event Listener
document.getElementById("generate").addEventListener("click", generateWaltz);
document.getElementById("save").addEventListener("click", () => {
	// Save the audio file locally
	let a = document.createElement("a");
	a.href = document.getElementById("player").src;
	a.download = `${generateFilename(globalSequence)}.wav`;
	a.click();
	URL.revokeObjectURL(a.href);
});