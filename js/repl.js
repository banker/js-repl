/*
Javascript REPL
Author: Kyle Banker (http://www.kylebanker.com)
Date: September 1, 2009
 
(c) Creative Commons 2009
http://creativecommons.org/licenses/by-sa/2.5/
*/

// Readline class to handle line input.
var ReadLine = function(options) {
  this.options      = options || {};
  this.htmlForInput = this.options.htmlForInput;
  this.inputHandler = this.options.handler || this.mockHandler;
  this.scoper       = this.options.scoper;
  this.terminal     = $(this.options.terminalId || "#terminal");
  this.lineClass    = this.options.lineClass || '.readLine';
  this.history      = [];
  this.historyPtr   = 0;

  this.initialize();
};

ReadLine.prototype = {

  initialize: function() {
    this.addInputLine();
  },

  // Enter a new input line with proper behavior.
  addInputLine: function(stackLevel) {
    stackLevel = stackLevel || 0;
    this.terminal.append(this.htmlForInput(stackLevel));
    var ctx = this;
    ctx.activeLine = $(this.lineClass + '.active');

    // Bind key events for entering and navigting history.
    ctx.activeLine.bind("keydown", function(ev) {
      switch (ev.keyCode) {
        case EnterKeyCode:
          ctx.processInput(this.value); 
          break;
        case UpArrowKeyCode: 
          ctx.getCommand('previous');
          break;
        case DownArrowKeyCode: 
          ctx.getCommand('next');
          break;
      }
    });

    $(document).bind("keydown", function(ev) {
      ctx.activeLine.focus();
    });

    this.activeLine.focus();
  },

  // Returns the 'next' or 'previous' command in this history.
  getCommand: function(direction) {
    if(this.history.length === 0) {
      return;
    }
    this.adjustHistoryPointer(direction);
    this.activeLine[0].value = this.history[this.historyPtr];
    this.activeLine.focus();
    this.activeLine[0].value = this.activeLine[0].value;
  },

  // Moves the history pointer to the 'next' or 'previous' position. 
  adjustHistoryPointer: function(direction) {
    if(direction == 'previous') {
      if(this.historyPtr - 1 >= 0) {
        this.historyPtr -= 1;
      }
    }
    else {
      if(this.historyPtr + 1 < this.history.length) {
        this.historyPtr += 1;
      }
    }
  },

  // Return the handler's response.
  processInput: function(value) {
    var response = this.inputHandler.apply(this.scoper, [value]);
    this.insertResponse(response.result);
    
    // Save to the command history...
    if((lineValue = value.trim()) !== "") {
      this.history.push(lineValue);
      this.historyPtr = this.history.length;
    }

    // deactivate the line...
    this.activeLine.value = "";
    this.activeLine.attr({disabled: true});
    this.activeLine.removeClass('active');

    // and add add a new command line.
    this.addInputLine(response.stack);
  },

  insertResponse: function(response) {
    if(response !== "") {
      this.activeLine.parent().append("<p class='response'>" + response + "</p>");
    }
  },

  // Simply return the entered string if the user hasn't specified a smarter handler.
  mockHandler: function(inputString) {
    return inputString; 
  }
};

var JsHandler = function() {
  this._currentCommand = "";
  this._functionStack  = 0;
  this._commandStack   = 0;
};

JsHandler.prototype = {

  _process: function(inputString, errorCheck) {
    try {
      inputString += '  '; // fixes certain bugs with the tokenizer.
      var tokens    = inputString.tokens();
      return this._evaluator(tokens);
    }

    catch(err) {
      // Catch js errors.
      this._resetCurrentCommand();
      return {stack: 0, result: "JS Error: " + err};
    }
  },

  // Calls eval on the input string when ready.
  _evaluator: function(tokens) {
    this._currentCommand += " " + this._clearVars(tokens);
    if(this._shouldEvaluateCommand(tokens))  {
      
        // So this is the heart of the REPL.
        console.log(this._currentCommand);
        var result = Inspect(eval(this._currentCommand.trim()));
        if(result === undefined) {
          throw('error');
        }
        this._resetCurrentCommand();
        return {stack: this._commandStack, result: result};
      }
    else {
      return {stack: this._commandStack, result: ""};
    }
  },

  _resetCurrentCommand: function() {
    this._currentCommand = '';
    this._rawCommand     = '';
  },

  // Evaluate only when we've exited any blocks.
  _shouldEvaluateCommand: function(tokens) {
    for(var i=0; i < tokens.length; i++) {
      var token = tokens[i];
      if(token.type == 'operator') {
        if(token.value == '(' || token.value == '{') {
          this._commandStack += 1;
        }
        else if(token.value == ')' || token.value == '}') {
          this._commandStack -= 1;
        }
      }
    }

    if(this._commandStack === 0) {
      return true;
    }
    else {
      return false;
    }
  },

  // Adds 'this' to scope any vars locally;
  // also removes the 'var' keyword (a tiny hack).
  _clearVars: function(tokens) {
    for(var i=0; i < tokens.length; i++) {
      if(tokens[i].type == 'name') {
        if(tokens[i].value == 'var') {
          tokens[i].value = '';
        }
      }
    }
    return this._collectTokens(tokens);
  },

  // Collects tokens into a string, placing spaces between variables.
  // This methods is called after we scope the vars.
  _collectTokens: function(tokens) {
    var result = "";
    for(var i=0; i < tokens.length; i++) {
      if(tokens[i].type == "name" && tokens[i+1] && (tokens[i+1].type == "name" || tokens[i+1].type == 'number')) {
        result += tokens[i].value + ' ';
      }
      else if (tokens[i].type == 'string') {
        result += "'" + tokens[i].value + "'";
      }
      else {
        result += tokens[i].value;
      }
    }
    return result;
  },

  // printsh output to the screen, e.g., in a loop
  // TODO: remove dependency here
  print: function() {
   $('.readline.active').parent().append('<p>' + arguments[0] + '</p>');      
   return '';
  }
};

$(document).ready(function() {
  var handler     = new JsHandler();
  var terminal    = new ReadLine({htmlForInput: DefaultInputHtml, 
                                  handler: handler._process, 
                                  scoper: handler});
});
