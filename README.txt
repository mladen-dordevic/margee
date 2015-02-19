Welcome to the MaRGEE (Moving and Rotating Google Earth Elements) git repository.
Below you can find a list of all files used in this project, along with a brief description of their functions. 
You can find the working version of the MaRGEE tool at http://geode.net/margee. Functionality and usability are described in :

Mladen M. Dordevic and Steven J. Whitmeyer
MaRGEE: Move and Rotate Google Earth Elements
Computers & Geosciences ( in review )

.
  |-css
  |  |-bootstrap.css 			//Twitter Bootstrap css file
  |  |-main.css				//Main css for the application
  |  |-normalize.css 			//Normalization css
  |-fonts
  |  |-glyphicons-halflings-regular.ttf
  |  |-glyphicons-halflings-regular.woff
  |-images
  |  |-geode_logo_black.png
  |  |-jmu_logo_purple.png
  |  |-logo.png
  |  |-oPole1.png
  |  |-target1.png
  |-js
  |  |-lib
  |  |  |-geo.js			//Library for calculations on the spherical surface
  |  |  |-Graticule.js			//Library for displaying grid on Google Maps
  |  |  |-jszip.js			//Library for adding zip capabilities
  |  |  |-save.js			//Library for saving files
  |  |  |-simplify.js			//Stack-based Douglas Peucker line simplification routine
  |  |  |-xmlwriter.js			//XML generator for JavaScript, based on .NET's XMLTextWriter
  |  |-main.js				//Contains main application and interface logic
  |  |-worker.js			//Contains functions that perform rotation
  |-index.html				//Main HTML file containing application interface