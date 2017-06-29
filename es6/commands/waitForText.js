import events from 'events';

/**
 * This custom command allows us to locate an HTML element on the page and then wait until the value of the element's
 * inner text (the text between the opening and closing tags) matches the provided expression (aka. the 'checker' function).
 * It retries executing the checker function every 100ms until either it evaluates to true or it reaches
 * maxTimeInMilliseconds (which fails the test).
 * Nightwatch uses the Node.js EventEmitter pattern to handle asynchronous code so this command is also an EventEmitter.
 *
 * h3 Examples:
 *
 *     browser.waitForText("div", function(text) {
 *         return text === "something";
 *     });
 *
 * @author dkoo761
 * @see https://github.com/beatfactor/nightwatch/issues/246#issuecomment-59461345
 * @param {String} elementSelector - css/xpath selector for the element
 * @param {Function} checker - function that must return true if the element's text matches your requisite, false otherwise
 * @param {Integer} [timeoutInMilliseconds] - timeout of this wait commands in milliseconds
*/

class WaitForText extends events.EventEmitter {
	constructor() {
		super();

		this.timeoutRetryInMilliseconds = 100;
		this.defaultTimeoutInMilliseconds = 5000;
		this.locateStrategy = "css";
		this.startTimeInMilliseconds = null;
	}

	restoreLocateStrategy() {
		if (this.locateStrategy === "xpath") { this.api.useXpath(); }
		if (this.locateStrategy === "css") { return this.api.useCss(); }
	}

	command(elementSelector, checker, timeoutInMilliseconds) {
		//Save the origian locate strategy, because if this command is used with
		//page objects, the "checker" function of this command is wrapped with another
		//function which resets the locate strategy after the function is called,
		//but since the function is called many times, from the second one the locateStrategy
		//is wrong
		this.locateStrategy = this.client.locateStrategy;

		this.startTimeInMilliseconds = new Date().getTime();

		if (typeof timeoutInMilliseconds !== 'number') {
			timeoutInMilliseconds = this.api.globals.waitForConditionTimeout;
		}
		if (typeof timeoutInMilliseconds !== 'number') {
			timeoutInMilliseconds = this.defaultTimeoutInMilliseconds;
		}

		this.check(elementSelector, checker, (result, loadedTimeInMilliseconds) => {
			if (result) {
				var message = `waitForText: ${elementSelector}. Expression was true after ${loadedTimeInMilliseconds - this.startTimeInMilliseconds} ms.`;
			} else {
				var message = `waitForText: ${elementSelector}. Expression wasn't true in ${timeoutInMilliseconds} ms.`;
			}
			
			this.client.assertion(result, 'expression false', 'expression true', message, true);
			return this.emit('complete');
		}, timeoutInMilliseconds);

		return this;
	}

	check(elementSelector, checker, callback, maxTimeInMilliseconds) {
		//Restore the origian locate strategy
		this.restoreLocateStrategy();

		return this.api.getText(elementSelector, result => {
			let now = new Date().getTime();
			if (result.status === 0 && checker(result.value)) {
				return callback(true, now);
			} else if (now - this.startTimeInMilliseconds < maxTimeInMilliseconds) {
				return setTimeout(() => {
					return this.check(elementSelector, checker, callback, maxTimeInMilliseconds);
				}, this.timeoutRetryInMilliseconds);
			} else {
				return callback(false);
			}
		});
	}
}

export default WaitForText;