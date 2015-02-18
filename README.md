Syracuse CoWorks Butler
=======================

An angularjs based, node served splash page verification system for Meraki access points.

##Installation

###Requirements
Firstly, you will need node/npm installed.
Install [Gulp](http://gulpjs.com) globally if you have not already:
```
npm install --global gulp
```

###Steps
1. Clone this repo into a directory, and move into it
2. Install *npm* requirements: `npm install`
3. Build and compile application: `gulp build`
4. Copy *config.js-example* to *config.js*, and fill it out
5. Run node app: `node .`  or `node index.js`

You can then point your Meraki Custom Splash URL to http://your.host:port/splash

From https://kb.meraki.com/knowledge_base/configuring-a-custom-hosted-splash-page-to-work-with-the-meraki-cloud

###Configure access control
1. Login to Dashboard and navigate to Configure -> "Access control."
2. Select the SSID you want to configure from the SSID drop-down.
3. Under "Network access" -> "Association requirements," choose "Open", "WPA2," or "WEP."
4. Under "Network access" -> "Network sign-on method", choose "Click-through splash page" or "Sign-on splash page."
5. Enable walled garden (located under "Network access" -> "Walled garden") and enter the IP address of your web server.
6. Click "Save Changes."

###Enabling a Custom-Hosted Splash page on the Meraki Cloud.
1. Navigate to Configure -> Splash page
2. Select the SSID you want to configure from the SSID drop-down.
3. Under Custom splash URL select the radio button Or provide a URL where users will be redirected:
4. Type the URL of your custom splash page (ie. http://yourwebsite.com/yourphpscript.php).
5. Click "Save Changes"