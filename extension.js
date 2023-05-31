const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const cp = require('child_process');

const execOptions = {
	env: {
		PATH: '/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin',
	},
};

const optimizeJpg = (filePath, quality) => {
	const options = [
		'-m' + quality, // set maximum quality to 85%
		'--strip-all', // this strips out all text information such as comments and EXIF data
		'--all-progressive', // this will make sure the resulting image is a progressive one
	];

	const command = 'jpegoptim ' + options.join(' ') + ' ' + filePath;

	console.log(command);

	try {
		cp.execSync(command, execOptions);
	} catch (err) {
		console.error(err.stderr.toString());
		vscode.window.showErrorMessage(err.stderr.toString());
	}
};

const optimizePng = (filePath) => {
	const options = [
		'--force', // required parameter for this package
		'--skip-if-larger',
		'--strip',
	];

	const command = 'pngquant ' + options.join(' ') + ' ' + filePath + ' --output=' + filePath;

	console.log(command);

	try {
		cp.execSync(command, execOptions);
	} catch (err) {
		console.error(err.stderr.toString());
		vscode.window.showErrorMessage(err.stderr.toString());
	}
};

const optimizeConvertWebp = (input, output, quality, width) => {
	const options = [
		'-m 6', // for the slowest compression method in order to get the best compression.
		'-pass 10', // for maximizing the amount of analysis pass.
		'-mt', // multithreading for some speed improvements.
		'-q ' + quality, //quality factor that brings the least noticeable changes.
	];

	if (width) {
		options.push('-resize ' + width + ' 0');
	}

	const command = 'cwebp ' + options.join(' ') + ' ' + input + ' -o ' + output;

	console.log(command);

	try {
		cp.execSync(command, execOptions);
	} catch (err) {
		console.error(err.stderr.toString());
		vscode.window.showErrorMessage(err.stderr.toString());
	}
};

const convertAvif = (input, output, width) => {
	const options = [];

	if (width) {
		options.push('-resize ' + width + ' 0');
	}

	const command = 'convert ' + options.join(' ') + ' ' + input + ' ' + output;

	try {
		cp.execSync(command, execOptions);
	} catch (err) {
		console.error(err.stderr.toString());
		vscode.window.showErrorMessage(err.stderr.toString());
	}
}

const covertFromWebp = (input, output) => {
	const command = 'dwebp ' + input + ' -o - | convert - ' + output;

	console.log(command);

	try {
		cp.execSync(command, execOptions);
	} catch (err) {
		console.error(err.stderr.toString());
		vscode.window.showErrorMessage(err.stderr.toString());
	}
};

const resize = (input, output, width) => {
	const command = 'convert ' + input + ' -resize ' + width + 'x ' + output;

	console.log(command);

	try {
		cp.execSync(command, execOptions);
	} catch (err) {
		console.error(err.stderr.toString());
		vscode.window.showErrorMessage(err.stderr.toString());
	}
};

const lqip = (input, output, resize = 64) => {
	const command = 'convert ' + input + ' -adaptive-resize ' + resize + 'x -define webp:target-size=1024 -define webp:mode=6 -define webp:preprocessing=2 ' + output;

	console.log(command);

	try {
		cp.execSync(command, execOptions);
	} catch (err) {
		console.error(err.stderr.toString());
		vscode.window.showErrorMessage(err.stderr.toString());
	}
};

const getWidth = (input) => {
	const command = 'identify -format "%w" ' + input;

	console.log(command);

	try {
		return cp.execSync(command, execOptions);
	} catch (err) {
		console.error(err.stderr.toString());
		vscode.window.showErrorMessage(err.stderr.toString());

		return '';
	}
};

const selectLQIPType = async () => {
	return await vscode.window.showQuickPick(['jpg', 'webp', 'avif'], {
		placeHolder: 'Select lqip format',
	});
}

const generateImages = (uri, quality, type) => {
	const input = uri.fsPath;
	const files = {};

	files[input] = fs.statSync(input).size;

	const filename = path.basename(input);
	const extension = path.extname(filename);

	const response = [];
	response.push(filename);
	response.push('Filesize: ' + Math.floor(files[input] / 1024) + 'kB');

	const lqipType = type ? type : 'jpg';
	quality = parseInt(quality);
	const { lqipSize, avifSupport } = vscode.workspace.getConfiguration('responsive-images');

	const lqipResize = lqipSize || 64;

	if (quality > 0 && quality <= 100) {
		response.push('Target quality: ' + quality + '%');

		let width = getWidth(input).toString();
		console.log('width', width);

		width = parseInt(width);

		if (width > 0) {
			response.push('2x width: ' + width + 'px');

			if (extension === '.jpg') {
				const output1xJpg = input.replace(/@2x.jpg$/, '.jpg');
				const output2xWebp = input.replace(/.jpg$/, '.webp');
				const output1xWebp = input.replace(/@2x.jpg$/, '.webp');
				const outputLqip = input.replace(/@2x.jpg$/, '@lqip.jpg');

				// 2x webp convert and optimize
				optimizeConvertWebp(input, output2xWebp, quality);
				files[output2xWebp] = fs.statSync(output2xWebp).size;

				if (avifSupport) {
					const output2xAvif = input.replace(/.jpg$/, '.avif');
					const output1xAvif = input.replace(/@2x.jpg$/, '.avif');
					// Avif 1x
					convertAvif(input, output1xAvif, width / 2);
					files[output1xAvif] = fs.statSync(output1xAvif).size;

					// Avif 2x
					convertAvif(input, output2xAvif);
					files[output2xAvif] = fs.statSync(output2xAvif).size;
				}

				// 1x jpg resize and optimize
				resize(input, output1xJpg, width / 2);
				optimizeJpg(output1xJpg, quality);
				files[output1xJpg] = fs.statSync(output1xJpg).size;

				// 1x webp convert and optimize
				optimizeConvertWebp(input, output1xWebp, quality, width / 2);
				files[output1xWebp] = fs.statSync(output1xWebp).size;

				// lqip jpg resize
				lqip(input, outputLqip);
				files[outputLqip] = fs.statSync(outputLqip).size;

				// original optimize
				optimizeJpg(input, quality);
				files[input] = fs.statSync(input).size;

			} else if (extension === '.png') {
				const output1xPng = input.replace(/@2x.png$/, '.png');
				const output2xWebp = input.replace(/.png$/, '.webp');
				const output1xWebp = input.replace(/@2x.png$/, '.webp');
				const outputLqip = input.replace(/@2x.png$/, `@lqip.${lqipType}`);

				// 2x webp convert and optimize
				optimizeConvertWebp(input, output2xWebp, quality);
				files[output2xWebp] = fs.statSync(output2xWebp).size;

				if (avifSupport) {
					const output2xAvif = input.replace(/.png$/, '.avif');
					const output1xAvif = input.replace(/@2x.png$/, '.avif');
					// Avif 1x
					convertAvif(input, output1xAvif, width / 2);
					files[output1xAvif] = fs.statSync(output1xAvif).size;

					// Avif 2x
					convertAvif(input, output2xAvif);
					files[output2xAvif] = fs.statSync(output2xAvif).size;
				}

				// 1x png resize and optimize
				resize(input, output1xPng, width / 2);
				optimizePng(output1xPng);
				files[output1xPng] = fs.statSync(output1xPng).size;

				// 1x webp convert and optimize
				optimizeConvertWebp(input, output1xWebp, quality, width / 2);
				files[output1xWebp] = fs.statSync(output1xWebp).size;

				// lqip jpg resize
				lqip(input, outputLqip, lqipResize);
				files[outputLqip] = fs.statSync(outputLqip).size;

				// original optimize
				optimizePng(input);
				files[input] = fs.statSync(input).size;

			} else if (extension === '.webp') {
				const output2xJpg = input.replace(/.webp$/, '.jpg');
				const output1xJpg = input.replace(/@2x.webp$/, '.jpg');
				const output1xWebp = input.replace(/@2x.webp$/, '.webp');
				const outputLqip = input.replace(/@2x.webp$/, `@lqip.${lqipType}`);

				// 2x jpg convert and optimize
				covertFromWebp(input, output2xJpg);
				optimizeJpg(output2xJpg, quality);
				files[output2xJpg] = fs.statSync(output2xJpg).size;

				if (avifSupport) {
					const output2xAvif = input.replace(/.webp$/, '.avif');
					const output1xAvif = input.replace(/@2x.webp$/, '.avif');
					// Avif 1x
					convertAvif(input, output1xAvif, width / 2);
					files[output1xAvif] = fs.statSync(output1xAvif).size;

					// Avif 2x
					convertAvif(input, output2xAvif);
					files[output2xAvif] = fs.statSync(output2xAvif).size;
				}

				// 1x jpg resize and optimize
				resize(output2xJpg, output1xJpg, width / 2);
				optimizeJpg(output1xJpg, quality);
				files[output1xJpg] = fs.statSync(output1xJpg).size;

				// 1x webp convert and optimize
				optimizeConvertWebp(input, output1xWebp, quality, width / 2);
				files[output1xWebp] = fs.statSync(output1xWebp).size;

				// lqip jpg resize
				lqip(output2xJpg, outputLqip, lqipResize);

				files[outputLqip] = fs.statSync(outputLqip).size;

				// original optimize
				optimizeConvertWebp(input, input, quality);
				files[input] = fs.statSync(input).size;
			}

			response.push('');

			for (const file in files) {
				response.push(
					path.basename(file) + ': ' +
					(files[file] > 1024 ? Math.floor(files[file] / 1024) + 'kB' : files[file] + 'B')
				);
			}

			vscode.window.showInformationMessage(response.join('\n'), { modal: false });
		} else {
			vscode.window.showErrorMessage('Invalid image width');
		}
	} else {
		vscode.window.showErrorMessage('Invalid quality value');
	}
}

/**
 * @param {vscode.ExtensionContext} context
 */
const activate = (context) => {
	let disposable = vscode.commands.registerCommand('responsive-images.generateFrom2x', (uri) => {
		const { quality, lqipType } = vscode.workspace.getConfiguration('responsive-images');

		if (quality && lqipType) {
			generateImages(uri, quality, lqipType);
		}

		if (!quality && lqipType) {
			vscode.window.showInputBox({
				prompt: 'Quality',
				value: 90,
			}).then((quality) => {
				generateImages(uri, quality, lqipType);
			})
		}

		if (quality && !lqipType) {
			selectLQIPType().then((type) => {
				generateImages(uri, quality, type);
			});
		}

		if (!quality && !lqipType) {
			vscode.window.showInputBox({
				prompt: 'Quality',
				value: 90,
			}).then((quality) => {
				selectLQIPType().then((type) => {
					generateImages(uri, quality, type);
				})
			});
		}
	});

	context.subscriptions.push(disposable);
}

const deactivate = () => { };

module.exports = {
	activate,
	deactivate
}
