const { remote } = require('webdriverio');
const { bootstrap } = require('global-agent');
const path = require('node:path');
const fs = require('node:fs/promises');
const { appendFile } = require('node:fs');
const { count } = require('node:console');

// export GLOBAL_AGENT_HTTP_PROXY=$HTTPS_PROXY
bootstrap();

let driver;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const click = async el => {
	try {
		const x = await driver.$(el);
		await x.click();
		return true;
	}
	catch {
		return false;
	}
}
const clickByUIautomator = async el => {
	const x = await driver.$("-android uiautomator:" + el);
	await x.click();
	return x;
}
const pressBack = async times => {
	for (let t = 0; t < times; t++)
		await driver.executeScript("mobile: pressKey", [{ "keycode": 4 }]); // BACK
}
const downFor = async times => {
	for (let t = 0; t < times; t++)
		await driver.executeScript("mobile: pressKey", [{ "keycode": 20 }]); // DOWN
}
const goto = async (selectorKey, url) => {
	let el4 = await clickByUIautomator(
		'new UiSelector().resourceId("' + selectorKey + ':id/url_bar")');
	await el4.addValue(url);
	await clickByUIautomator(
		'new UiSelector().resourceId("' + selectorKey + ':id/line_1")');
}

function MakePath(config, file) {
	return path.join(
		config.outputFolder,
		config.deviceName.replaceAll(' ', '_'),
		file
	)
}

// driver.addCommand('sendCommandFromWebSocket', command('POST', '/session/:sessionId/chromium/send_command', {
//     command: 'sendCommandFromWebSocket',
//     description: 'sendCommandFromWebSocket chromium command',
//     ref: 'https://vendor.com/commands/#myNewCommand',
//     // variables: [{
//     //     name: 'someId',
//     //     description: 'some id to something'
//     // }],
//     parameters: [{
//         name: 'method',
//         type: 'string',
//         description: 'a valid parameter',
//         required: true
//     }, {
//         name: 'params',
//         type: 'object',
//         description: 'a valid parameter',
//         required: true
//     }, {
//         name: 'id',
//         type: 'number',
//         description: 'a valid parameter',
//         required: true
//     }]
// }))
// await driver.sendCommandFromWebSocket("lll", {}, -1);

async function testApp(isLocal, config) {
	console.log("Starting");

	const logDirectory = MakePath(config, "");
	try {
		await fs.mkdir(logDirectory, { recursive: true });
	} catch {
		if (!config.skipCheckDirectory) {
			console.log("Directory " + logDirectory + " already exists.");
			process.exit(0);
		}
	}

	let selectorKey = "org.cromite.cromite";
	let isChromium = false;
	if (config.appName == "chromium") {
		selectorKey = "org.chromium.chrome"; //.stable"; //"org.chromium.chrome";
		isChromium = true;
	}

	const capabilities_local = {
		platformName: 'android',
		'appium:automationName': 'UiAutomator2',
		'appium:appPackage': selectorKey,
		'appium:appActivity': 'com.google.android.apps.chrome.Main',

		'appium:showChromedriverLog': true,
		//'appium:recreateChromeDriverSessions': true,

		'appium:chromeOptions': {
			'androidDeviceSocket': 'chrome_devtools_remote', // cat /proc/net/unix
			'androidExecName': 'unusedbutimportant',
		},
	};

	const capabilities_bs = {
		"platformName": "android",

		"appium:deviceName": config.deviceName,
		"appium:app": config.appName,

		'bstack:options': {
			"appiumVersion": "2.4.1",
			"disableAnimations": "true",
			"userName": config.BROWSERSTACK_USERNAME,
			"accessKey": config.BROWSERSTACK_ACCESS_KEY,
		},

		// Set other BrowserStack capabilities
		// 'project' : 'First NodeJS project',
		// 'build' : 'Node Android',
		// 'name': 'first_test',
		// 'unicodeKeyboard': 'true',
		// 'resetKeyboard': 'true',
	};

	if (!isLocal) {
		driver = await remote({
			capabilities: capabilities_bs,
			hostname: 'hub-cloud.browserstack.com',
			path: '/wd/hub',
			protocol: 'https',
			port: 443,
			strictSSL: true,
			logLevel: 'trace',
		});
	} else {
		driver = await remote({
			capabilities: capabilities_local,
			hostname: '127.0.0.1',
			port: 4723,
		});
	}

	try {
		const info = await driver.executeScript("mobile: deviceInfo", [{}]);
		console.log(info);

		await fs.writeFile(MakePath(config, "info.json"), JSON.stringify(info));

		// cromite
		const terms_accept_present = await driver.findElement("id", selectorKey + ":id/terms_accept");
		console.log(!terms_accept_present.error);
		if (!terms_accept_present.error) {
			await click("id:" + selectorKey + ":id/terms_accept");

			await clickByUIautomator(
				'new UiSelector().resourceId("' + selectorKey + ':id/default_search_engine_dialog_options")' +
				'.childSelector(new UiSelector().className("android.widget.RadioButton"))');

			await click("id:" + selectorKey + ":id/button_primary");
		}

		// chromium
		if (isChromium) await sleep(4000);
		const signin_fre_dismiss_button = await await driver.findElement("id", selectorKey + ":id/signin_fre_dismiss_button");
		if (!signin_fre_dismiss_button.error) {
			await click("id:" + selectorKey + ":id/signin_fre_dismiss_button");
		}
		else {
			const signin_fre_continue_button = await await driver.findElement("id", selectorKey + ":id/signin_fre_continue_button");
			if (!signin_fre_continue_button.error) {
				await click("id:" + selectorKey + ":id/signin_fre_continue_button");
			}
		}

		// click menu
		await clickByUIautomator(
			'new UiSelector().resourceId("' + selectorKey + ':id/menu_button")');
		await sleep(1000);

		// click on preferences
		if (!await click("id:" + selectorKey + ":id/preferences_id")) {
			await driver.executeScript("mobile:flingGesture",
				[{ "left": 400, "top": 100, "width": 200, "height": 200, "direction": "down" }]);
			await click("id:" + selectorKey + ":id/preferences_id");
		}
		await sleep(1000);

		// disable adblock
		await clickByUIautomator(
			'new UiSelector().text("Adblock Plus settings")');
		await sleep(1000);
		await clickByUIautomator(
			'new UiSelector().text("Enable Adblock Plus")');

		// go back on preferences
		await pressBack(1);
		await sleep(1000);

		// move preferences layout
		if (!await driver.executeScript("mobile:flingGesture",
					[{ "left": 100, "top": 100, "width": 200, "height": 400, "direction": "down" }])) {
			await downFor(20);
		}
		await sleep(1000);

		// click on developer options
		await clickByUIautomator(
			'new UiSelector().text("Developer options")');

		// enable cromite test pref
		await clickByUIautomator(
			'new UiSelector().text("Enable support for cromite test")');

		// enable webview mode (only if chromium or is local)
		if (!isLocal && !isChromium) {
			await clickByUIautomator(
				'new UiSelector().text("Enable webview support for cromite test")');
		}

		// enable pixel perfect mode
		await clickByUIautomator(
			'new UiSelector().text("Pixel Perfect Mode")');

		// restart cromite
		await clickByUIautomator(
			'new UiSelector().resourceId("' + selectorKey + ':id/snackbar_button")');
		await sleep(2000);

		// wait for restart
		let count = 0;
		while ((await driver.findElement("id", selectorKey + ":id/url_bar")).error) {
			await sleep(1000);
			count++;
			if (count > 10) break;
		}

		// open chrome://version
		await goto(selectorKey, "chrome://version");

		// change the context
		let contexts = await driver.getContexts();
		console.log(contexts);

		if (!isLocal && !isChromium) {
			await driver.switchContext('WEBVIEW_' + selectorKey);
		} else {
			await driver.switchContext('WEBVIEW_chrome');
		}

		contexts = await driver.getContexts();
		console.log(contexts);

		// start update of cromite fonts pack
		await driver.executeScript(
			'await window.cromite.startComponentUpdate("gcmjkmgdlgnkkcocmoeiminaijmmjnii")', []);

		count = 0;
		for (; ;) {
			let version = await driver.executeScript(
				'return JSON.parse(await window.cromite.getComponentData("gcmjkmgdlgnkkcocmoeiminaijmmjnii")).version;', []);
			console.log(version);
			if (version != "0.0.0.0") break;

			count++;
			if (count > 20) break;
			await sleep(10000);
		}

		// open creepjs
		await driver.executeScript('window.location.href="https://abrahamjuliot.github.io/creepjs"', []);
		if (!isLocal)
			await sleep(10000);
		else
			await sleep(30000);

		// get creepjs json
		let creep = await driver.executeScript("return JSON.stringify(window.Creep);", []);
		await fs.writeFile(MakePath(config, "creep.json"), creep);

		let fingerprint = await driver.executeScript("return JSON.stringify(window.Fingerprint);", []);
		await fs.writeFile(MakePath(config, "fingerprint.json"), fingerprint);
	} finally {
		await driver.deleteSession();
		driver = undefined;
	}
}

if (process.argv.length <= 3) {
	console.error('Args:');
	console.error(' [local|bs]     running environment');
	console.error(' [devicename]   device');
	console.error(' [app name]     bs device name');
	process.exit(1);
}

if (process.env.BROWSERSTACK_OUTPUT_FOLDER === undefined) {
	console.error('set BROWSERSTACK_OUTPUT_FOLDER env variable');
	process.exit(1);
}

let isLocal = process.argv[2] === 'local';
if (!isLocal) {
	if (process.env.BROWSERSTACK_USERNAME === undefined) {
		console.error('set BROWSERSTACK_USERNAME env variable');
		process.exit(1);
	}
	if (process.env.BROWSERSTACK_ACCESS_KEY === undefined) {
		console.error('set BROWSERSTACK_ACCESS_KEY env variable');
		process.exit(1);
	}
	testApp(/*isLocal*/ false, {
		deviceName: process.argv[3],
		appName: process.argv[4],
		BROWSERSTACK_USERNAME: process.env.BROWSERSTACK_USERNAME,
		BROWSERSTACK_ACCESS_KEY: process.env.BROWSERSTACK_ACCESS_KEY,
		outputFolder: process.env.BROWSERSTACK_OUTPUT_FOLDER,
		skipCheckDirectory: false,
	});
} else {
	testApp(/*isLocal*/ true, {
		deviceName: process.argv[3],
		appName: process.argv[4],
		outputFolder: process.env.BROWSERSTACK_OUTPUT_FOLDER,
		skipCheckDirectory: true,
	});
}
