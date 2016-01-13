# Screenset Validation
Gigya SDK extension for advanced validation with custom error messages for Gigya screensets.

### How to enable
To enable the new ````validation```` parameter, include the following JavaScript file on your page after Gigya's SDK. I recommend using the validation parameter in your global configuration instead of individual ````showScreenSet```` calls (you must use ````window.__gigyaConf```` not script tag).

````js
<script type="text/javascript" src="//d1ubmrxmgxxi5o.cloudfront.net/screenset-validation.min.js"></script>
````

### Demo site
[gigya.github.io/screenset-validation](http://gigya.github.io/screenset-validation)

Testing instructions:

1. You cannot enter an email with any lowercase characters.
2. Your first name must start with a capital letter.
3. The subscribe checkbox is mandatory.

### Example implementation
````js
<script type="text/javascript">
window.__gigyaConf = {
  validation: {
    // formData contains all information user has entered
    // eventType is either "change" or "keypress"
    // callback is optional, you can use it for asynchronous validation or just use return

    'gigya-register-screen': function(formData, eventType, callback) {
      var errors = {};

      // Override default error message for required fields.
      if(formData['email'] === '') {
        errors['email'] = 'We need your email, please!';
      }

      // This will fail if the email has any lowercase characters.
      if(formData['email'] && formData['email'] !== formData['email'].toUpperCase()) {
        errors['email'] = 'Lowercase characters not allowed';
      }

      // This will fail if the first name doesn't start with a capital letter.
      if(formData['profile.firstName'] && formData['profile.firstName'].substr(0, 1) !== formData['profile.firstName'].toUpperCase().substr(0, 1)) {
        errors['profile.firstName'] = 'First names start with capital letters';
      }

      // Make checkbox mandatory.
      if(!formData['data.subscribe']) {
        // Checkboxes don't have error messages.
        errors['data.subscribe'] = true;
      }

      // You can return errors OR use callback for validation via AJAX.
      return errors;
    },


    'gigya-complete-registration-screen': function(formData, eventType, callback) {
      var errors = {};

      // This will fail if the email has any lowercase characters.
      if(formData['profile.email'] && formData['profile.email'] !== formData['profile.email'].toUpperCase()) {
        errors['profile.email'] = 'Lowercase characters not allowed';
      }

      return errors;
    }
  }
};
</script>
<script type="text/javascript" src="http://cdn.gigya.com/JS/gigya.js?apiKey=3_56CgIuwIjbF03nCwBUkuXzAOlYBkzfiH6PDqavQEESvOk-zxB2tr2xAP2YgDg6Ih"></script>
<script type="text/javascript" src="//d1ubmrxmgxxi5o.cloudfront.net/screenset-validation.min.js"></script>
````
