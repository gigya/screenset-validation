(function() {
'use strict';

// Minor shim.
if(!Object.keys) {
  Object.keys = function (obj) {
    var arr = [];
    var key;
    for(key in obj) {
      if(obj.hasOwnProperty(key)) {
        arr.push(key);
      }
    }
    return arr;
  };
}

// Log errors safely.
function err() {
  if(typeof console === 'object' && console.error) {
    console.error.apply(console, arguments);
  }
}

// Call user-provided validation function.
// May be called a bunch of times in a row with the same form values, optimize this use-case.
var lastResponse = {};
function userValidate(validateFunc, formData, eventType, callback) {
  // Check to see if we know the answer.
  var formDataStr = JSON.stringify(formData) + eventType;
  if(lastResponse.formDataStr === formDataStr) {
    if(lastResponse.errors) {
      callback(lastResponse.errors);
    } else {
      if(!lastResponse.watchers) {
        lastResponse.watchers = [];
      }
      lastResponse.watchers.push(callback);
    }
    return;
  }
  lastResponse = { formDataStr: formDataStr };

  // Validation function accepts both callback or return value.
  var validationResultCallbackFired = false;
  var maybeErrors = validateFunc(formData, eventType, validationResultCallback);
  if(maybeErrors) {
    validationResultCallback(maybeErrors);
  }

  function validationResultCallback(errors) {
    // Don't trigger twice.
    if(validationResultCallbackFired === true) {
      err('Validate result triggered twice - do not return an object AND fire callback');
      return;
    }
    validationResultCallbackFired = true;

    // Save last response.
    lastResponse.errors = errors;

    // Notify watchers.
    if(lastResponse.watchers) {
      var i;
      for(i in lastResponse.watchers) {
        lastResponse.watchers[i](errors);
      }
    }

    callback(errors);
  }
}

// Listen for accounts plugin lazy-load initialization.
var setPluginInstance = gigya._.plugins.setPluginInstance;
gigya._.plugins.setPluginInstance = function(params, plugin) {
  if(plugin.namespace === 'accounts') {
    try {
      patchSDK();
    } catch(e) {
      err('Failed to initialize screenset validation', e);
    }
  }
  return setPluginInstance.apply(this, arguments);
};

// Patch SDK with new functionality.
function patchSDK() {
  // For CONSTANT (var) reference.
  var ScreenSet = gigya._.plugins.ScreenSet;

  // Enable error handling on all checkboxes.
  var TermsInput = gigya._.plugins.ScreenSet.TermsInput;
  TermsInput.FORM_TYPE_CRITERIA = function(context) {
    return context.type === 'checkbox';
  };

  // Don't try to determine if login ID is available when there is a validation error.
  // Don't override error when login ID is available.
  var LoginIdInput = gigya._.plugins.ScreenSet.LoginIdInput;
  var serverQueryDone = LoginIdInput.prototype.serverQueryDone;
  LoginIdInput.prototype.serverQueryDone = function(res, checkedValue, callback) {
    if(this._validityState !== ScreenSet.ValidityStates.error) {
      serverQueryDone.apply(this, arguments);
    }
  };

  var BaseForm = gigya._.plugins.ScreenSet.BaseForm;

  // Typically, validate ensures all Gigya requirements are met.
  // Then onBeforeSubmit is called to fulfill all other requirements.
  // Finally, the actual API call to Gigya provides a 3rd verification.
  // Hooking in here allows us to merge step 1 and 2 into a single step which is a cleaner UX.
  var validate = BaseForm.prototype.validate;
  BaseForm.prototype.validate = function(callback) {
    var _this = this;
    var args = arguments;

    // Get params passed to showScreenSet.
    var params = _this._screenSet.params;

    // Get screen ID.
    var screenID = _this._parent.ID;

    // We're not interested unless the validation param was passed for this screen.
    if(!params.validation || typeof params.validation !== 'object' || !params.validation[screenID]) {
      return validate.apply(_this, args);
    }

    // Activate dimmer.
    _this._screen.dimScreen();

    // Create form data and pass to custom validation function.
    userValidate(params.validation[screenID], _this.getFlatFormData(false, true), 'submit', function(errors) {
      // Hide dimmer.
      _this._screen.undimScreen();

      // Check if no errors were returned (in which case we do nothing).
      if(!errors || typeof errors !== 'object' || Object.keys(errors).length === 0) {
        return validate.apply(_this, args);
      }

      // Show Gigya errors.
      validate.call(_this, function(isValid) {
        // Show user errors. If Gigya also has an error, this'll take priority.
        var key;
        for(key in errors) {
          if(key === '_form') {
            _this.showErrors([{ errorCode: 400003, errorMessage: errors[key] }], true);
            continue;
          }

          // Get field and show red outline.
          // Field may not exist if is global form element.
          var field = _this.getField(key);
          if(field) {
            field.setValidityState(ScreenSet.ValidityStates.error, true);
          }

          // Show error in error display element.
          var errorDisplay = _this._errorDisplayElements[key] && _this._errorDisplayElements[key][0];
          if(errorDisplay && typeof errors[key] === 'string') {
            errorDisplay.showError({ errorCode: 400027, errorMessage: errors[key] });
          }
        }

        callback(false);
      });
    });
  };

  // Validate fields when they change.
  var onInputChange = BaseForm.prototype.onInputChange;
  BaseForm.prototype.onInputChange = function(field, setByScript) {
    var _this = this;
    var args = arguments;

    // Don't operate if new value set internally.
    if(setByScript) {
      return onInputChange.apply(_this, args);
    }

    // Get params passed to showScreenSet.
    var params = _this._screenSet.params;

    // Get screen ID.
    var screenID = _this._parent.ID;

    // We're not interested unless the validation param was passed for this screen.
    if(!params.validation || typeof params.validation !== 'object' || !params.validation[screenID]) {
      return onInputChange.apply(_this, args);
    }

    // Activate field loading spinner.
    field.setValidityState(ScreenSet.ValidityStates.pending);

    // Create form data and pass to custom validation function.
    userValidate(params.validation[screenID], _this.getFlatFormData(false, true), 'change', function(errors) {
      // Trigger Gigya errors for this field.
      onInputChange.apply(_this, args);

      // Add our errors to this field.
      var key = field.normalizedFieldName;
      if(errors[key]) {
        field.setValidityState(ScreenSet.ValidityStates.error, true);

        // Show error in error display element.
        var errorDisplay = _this._errorDisplayElements[key] && _this._errorDisplayElements[key][0];
        if(key === 'data.terms' && !errorDisplay && _this._errorDisplayElements['null']) {
          errorDisplay = _this._errorDisplayElements['null'][0];
        }
        if(errorDisplay && typeof errors[key] === 'string') {
          errorDisplay.showError({ errorCode: 400027, errorMessage: errors[key] });
        }
      }
    });
  }
};

// Append custom CSS to page.
var css = '.gigya-form-error-msg.gigya-error-msg-active { margin-top: 25px !important; } .gigya-composite-control-submit { padding-bottom: 0 !important; } .gigya-layout-row.link-row { margin-top: 25px; !important; }';
var head = document.head || document.getElementsByTagName('head')[0];
var style = document.createElement('style');
style.type = 'text/css';
if (style.styleSheet){
  style.styleSheet.cssText = css;
} else {
  style.appendChild(document.createTextNode(css));
}
head.appendChild(style);

})();