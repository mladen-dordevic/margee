/*
MARGEE Moving and Rotating Google Earth Elements
Authors: Mladen M. Dordevic, Steven J. Whitmeyer
James Madison University
contact whitmesj@jmu.edu
 */
var MARGEE = (function(){

	var pi = Math.PI;
	var EARTH_RADIUS = 6371000;

	/**
	 * Converts degrees to radians
	 * @method toRad
	 * @param {Number} deg: Decimal degrees
	 * @return Number
	 */
	function toRad(deg){
		return deg * Math.PI / 180;
	};

	/**
	 * Converts radians to degrees
	 * @method toDeg
	 * @param {Number} rad: In radians
	 * @return Number
	 */
	function toDeg(rad){
		return rad * 180 / Math.PI;
	};


	/**
	 * Calculates a baring given start and end point
	 * @method bearing
	 * @param {Number} lat1: Point I latitude in radians
	 * @param {Number} lon1: Point I longitude in radians
	 * @param {Number} lat2: Point II latitude in radians
	 * @param {Number} lon2: Point II longitude in radians
	 * @return {Number} Bearing in radians
	 */
	function bearing(lat1, lon1, lat2, lon2) {
		var dLon = (lon2 - lon1);

		return Math.atan2(
			(Math.sin(dLon) * Math.cos(lat2)),
			(Math.cos(lat1) * Math.sin(lat2)) - (Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon))
		);
	};

	/**
	 * Calculates angular distance between two points
	 * @method angularDistance
	 * @param {Number} lat1: Point I latitude in radians
	 * @param {Number} lon1: Point I longitude in radians
	 * @param {Number} lat2: Point II latitude in radians
	 * @param {Number} lon2: Point II longitude in radians
	 * @return {Number} Angular distance in radians
	 */
	function angularDistance(lat1, lon1, lat2, lon2){
		var dLat = lat2- lat1,
			dLon = lon2 - lon1,
			a = (Math.sin(dLat/2) * Math.sin(dLat/2)) + (Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon/2) * Math.sin(dLon/2));
		// a is the square of half the chord length between points
		return  2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
	};

	/**
	 * Calculates destination point given start point and heading and distance.
	 * @method destinationPoint
	 * @param {Number} lat1: Point I latitude in radians
	 * @param {Number} lon1: Point I longitude in radians
	 * @param {Number} heading: Heading in radians measured from N
	 * @param {Number} angD: angular distance to destination in radians
	 * @return {lat : Number, lon: Number } Latitude and longitude of a destination point in radians
	 */
	function destinationPoint(lat1, lon1, heading, angD ) {
		var lat = Math.asin(
			Math.sin(lat1) * Math.cos(angD) +
			Math.cos(lat1) * Math.sin(angD) * Math.cos(heading)
		);

		var lon = lon1 + Math.atan2(
			Math.sin(heading) * Math.sin(angD) * Math.cos(lat1),
			Math.cos(angD) - Math.sin(lat1) * Math.sin(lat)
		);
		return {lat : lat, lon : lon};
	};
	/**
	 * Handles data from main script, could be implemented in a worker
	 * tra, arrayLat, arrayLon, latPol, lonPol, azimuth, kink, bearing, distance
	 * @method work
	 * @param {
	 *      tra : String['s'||'t'||'r']
	 * 		arrayLat : Array[Number]
	 * 		arrayLon : Array[Number]
	 * 		latPol : Number
	 * 		lonPol : Number
	 * 		azimuth : Number
	 * 		kink : Number
	 * 		bearing : Number
	 * 		distance : Number
	 * } data to transform with the parameters
	 * @return {arrayLat : Array[Number], arrayLon : Array[Number]}: Latitude and longitude after transformation
	 */
	function work ( e ) {
		var res = {};
		if ( e.tra === "r" ) {
			res = rotateArrayLatLon(e.arrayLat, e.arrayLon, e.latPol, e.lonPol, e.azimuth);
		}
		if ( e.tra === "t" ) {
			var lat1 = toRad( e.arrayLat[0] ),
				lon1 = toRad( e.arrayLon[0] ),
				bear = toRad( e.bearing ),
				ad = e.distance * 1000 / EARTH_RADIUS,
				op = destinationPoint( lat1, lon1, bear + pi/2, pi/2 );

			e.azimuth = toDeg( ad );
			e.latPol = toDeg( op.lat );
			e.lonPol = toDeg( op.lon );
			res = rotateArrayLatLon(e.arrayLat, e.arrayLon, e.latPol, e.lonPol, e.azimuth );
		}
		if( e.tra === "s" ) {
			res = simplify( e.arrayLat, e.arrayLon, e.kink );
		}
		return {
			arrayLat : res.lat,
			arrayLon : res.lon
		};
	};


	/**
	 * Rotates point defined with latitude and longitude around Euler pole for given angle
	 * @method rotateLatLon
	 * @param {Number} lat: Latitude in decimal degrees of point being rotated
	 * @param {Number} lon: Longitude in decimal degrees of point being rotated
	 * @param {Number} latPol : Latitude of the Euler pole in decimal degrees
	 * @param {Number} lonPol: Longitude of Euler pole in decimal degrees
	 * @param {Number} azimuth : Angle of the rotation meshed clockwise from N in decimal degrees
	 * @return {lat : Number lon : Number} Final coordinates in decimal degrees
	 */
	function rotateLatLon( lat, lon, latPol, lonPol, azimuth ) {
		//sequential rotation
		var lat1 = toRad(latPol),
			lon1 = toRad(lonPol),

			lat2 =  toRad(lat),
			lon2 = toRad(lon),

			c = angularDistance(lat1, lon1, lat2, lon2),

			b = bearing(lat1, lon1, lat2, lon2);

		b = b + toRad(azimuth);

		var op = destinationPoint(lat1, lon1, b, c );

		return {
			lat : toDeg( op.lat ),
			lon : toDeg( op.lon ),
		};
	};

	/**
	 * Description
	 * @method rotateArrayLatLon
	 * @param {Array[Number]} latArray: Contains Latitudes of points in radians
	 * @param {Array[Number]} lonArray: Contains Longitude of points in radians
	 * @param {Number} latPol
	 * @param {Number} lonPol
	 * @param {Number} azimuth
	 * @return {lat : Array[Number], lon : Array[Number]} final Coordinates array in decimal degrees
	 * 	 */
	function rotateArrayLatLon(latArray, lonArray, latPol, lonPol, azimuth){
		var newLatArray = [];
		var newLonArray = [];
		for(var i = 0, l = latArray.length; i < l; i++){
			var c = rotateLatLon(latArray[i], lonArray[i], latPol, lonPol, azimuth);
			 newLatArray[i] = c.lat;
			 newLonArray[i] = c.lon;
		};
		return {
			lat:newLatArray,
			lon:newLonArray
		}
	}

	return work;
})();
