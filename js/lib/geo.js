/** Trims whitespace from string (q.v. blog.stevenlevithan.com/archives/faster-trim-javascript) */
if (typeof(String.prototype.trim) === "undefined") {
  String.prototype.trim = function() {
    return String(this).replace(/^\s\s*/, '').replace(/\s\s*$/, '');
  }
}


/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */
/*  Geodesy representation conversion functions (c) Chris Veness 2002-2010                        */
/*   - www.movable-type.co.uk/scripts/latlong.html                                                */
/*                                                                                                */
/*  Sample usage:                                                                                 */
/*    var lat = Geo.parseDMS('51° 28' 40.12? N');                                                 */
/*    var lon = Geo.parseDMS('000° 00' 05.31? W');                                                */
/*    var p1 = new Point(lat, lon);                                                              */
/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */

var Geo = {};  // Geo namespace, representing static class

/**
 * Parses string representing degrees/minutes/seconds into numeric degrees
 *
 * This is very flexible on formats, allowing signed decimal degrees, or deg-min-sec optionally
 * suffixed by compass direction (NSEW). A variety of separators are accepted (eg 3º 37' 09"W)
 * or fixed-width format without separators (eg 0033709W). Seconds and minutes may be omitted.
 * (Note minimal validation is done).
 *
 * @param   {String|Number} dmsStr: Degrees or deg/min/sec in variety of formats
 * @returns {Number} Degrees as decimal number
 * @throws  {TypeError} dmsStr is an object, perhaps DOM object without .value?
 */
Geo.parseDMS = function(dmsStr) {
  if (typeof deg == 'object') throw new TypeError('Geo.parseDMS - dmsStr is [DOM?] object');

  // check for signed decimal degrees without NSEW, if so return it directly
  if (typeof dmsStr === 'number' && isFinite(dmsStr)) return Number(dmsStr);

  // strip off any sign or compass dir'n & split out separate d/m/s
  var dms = String(dmsStr).trim().replace(/^-/,'').replace(/[NSEW]$/i,'').split(/[^0-9.,]+/);
  if (dms[dms.length-1]=='') dms.splice(dms.length-1);  // from trailing symbol

  if (dms == '') return NaN;

  // and convert to decimal degrees...
  switch (dms.length) {
    case 3:  // interpret 3-part result as d/m/s
      var deg = dms[0]/1 + dms[1]/60 + dms[2]/3600;
      break;
    case 2:  // interpret 2-part result as d/m
      var deg = dms[0]/1 + dms[1]/60;
      break;
    case 1:  // just d (possibly decimal) or non-separated dddmmss
      var deg = dms[0];
      // check for fixed-width unseparated format eg 0033709W
      if (/[NS]/i.test(dmsStr)) deg = '0' + deg;  // - normalise N/S to 3-digit degrees
      if (/[0-9]{7}/.test(deg)) deg = deg.slice(0,3)/1 + deg.slice(3,5)/60 + deg.slice(5)/3600;
      break;
    default:
      return NaN;
  }
  if (/^-|[WS]$/i.test(dmsStr.trim())) deg = -deg; // take '-', west and south as -ve
  return Number(deg);
}

/**
 * Convert decimal degrees to deg/min/sec format
 *  - degree, prime, double-prime symbols are added, but sign is discarded, though no compass
 *    direction is added
 *
 * @private
 * @param   {Number} deg: Degrees
 * @param   {String} [format=dms]: Return value as 'd', 'dm', 'dms'
 * @param   {Number} [dp=0|2|4]: No of decimal places to use - default 0 for dms, 2 for dm, 4 for d
 * @returns {String} deg formatted as deg/min/secs according to specified format
 * @throws  {TypeError} deg is an object, perhaps DOM object without .value?
 */
Geo.toDMS = function(deg, format, dp) {
  if (typeof deg == 'object') throw new TypeError('Geo.toDMS - deg is [DOM?] object');
  if (isNaN(deg)) return 'NaN';  // give up here if we can't make a number from deg

    // default values
  if (typeof format == 'undefined') format = 'dms';
  if (typeof dp == 'undefined') {
    switch (format) {
      case 'd': dp = 4; break;
      case 'dm': dp = 2; break;
      case 'dms': dp = 0; break;
      default: format = 'dms'; dp = 0;  // be forgiving on invalid format
    }
  }

  deg = Math.abs(deg);  // (unsigned result ready for appending compass dir'n)

  switch (format) {
    case 'd':
      d = deg.toFixed(dp);     // round degrees
      if (d<100) d = '0' + d;  // pad with leading zeros
      if (d<10) d = '0' + d;
      dms = d + '\u00B0';      // add º symbol
      break;
    case 'dm':
      var min = (deg*60).toFixed(dp);  // convert degrees to minutes & round
      var d = Math.floor(min / 60);    // get component deg/min
      var m = (min % 60).toFixed(dp);  // pad with trailing zeros
      if (d<100) d = '0' + d;          // pad with leading zeros
      if (d<10) d = '0' + d;
      if (m<10) m = '0' + m;
      dms = d + '\u00B0' + m + '\u2032';  // add º, ' symbols
      break;
    case 'dms':
      var sec = (deg*3600).toFixed(dp);  // convert degrees to seconds & round
      var d = Math.floor(sec / 3600);    // get component deg/min/sec
      var m = Math.floor(sec/60) % 60;
      var s = (sec % 60).toFixed(dp);    // pad with trailing zeros
      if (d<100) d = '0' + d;            // pad with leading zeros
      if (d<10) d = '0' + d;
      if (m<10) m = '0' + m;
      if (s<10) s = '0' + s;
      dms = d + '\u00B0' + m + '\u2032' + s + '\u2033';  // add º, ', " symbols
      break;
  }

  return dms;
}

/**
 * Convert numeric degrees to deg/min/sec latitude (suffixed with N/S)
 *
 * @param   {Number} deg: Degrees
 * @param   {String} [format=dms]: Return value as 'd', 'dm', 'dms'
 * @param   {Number} [dp=0|2|4]: No of decimal places to use - default 0 for dms, 2 for dm, 4 for d
 * @returns {String} Deg/min/seconds
 */
Geo.toLat = function(deg, format, dp) {
  var lat = Geo.toDMS(deg, format, dp);
  return lat=='' ? '' : lat.slice(1) + (deg<0 ? 'S' : 'N');  // knock off initial '0' for lat!
}

/**
 * Convert numeric degrees to deg/min/sec longitude (suffixed with E/W)
 *
 * @param   {Number} deg: Degrees
 * @param   {String} [format=dms]: Return value as 'd', 'dm', 'dms'
 * @param   {Number} [dp=0|2|4]: No of decimal places to use - default 0 for dms, 2 for dm, 4 for d
 * @returns {String} Deg/min/seconds
 */
Geo.toLon = function(deg, format, dp) {
  var lon = Geo.toDMS(deg, format, dp);
  return lon=='' ? '' : lon + (deg<0 ? 'W' : 'E');
}

/**
 * Convert numeric degrees to deg/min/sec as a bearing (0º..360º)
 *
 * @param   {Number} deg: Degrees
 * @param   {String} [format=dms]: Return value as 'd', 'dm', 'dms'
 * @param   {Number} [dp=0|2|4]: No of decimal places to use - default 0 for dms, 2 for dm, 4 for d
 * @returns {String} Deg/min/seconds
 */
Geo.toBrng = function(deg, format, dp) {
  deg = (Number(deg)+360) % 360;  // normalise -ve values to 180º..360º
  var brng =  Geo.toDMS(deg, format, dp);
  return brng.replace('360', '0');  // just in case rounding took us up to 360º!
}

/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */

/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */
/*  Vector-based geodetic (latitude/longitude) functions              (c) Chris Veness 2011-2014  */
/*                                                                                                */
/*  These functions work with                                                                     */
/*   a) geodesic (polar) latitude/longitude points on the earth's surface (in degrees)            */
/*   b) 3D vectors used as n-vectors representing points on the surface of the earth's surface,   */
/*      or vectors normal to the plane of a great circle                                          */
/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */

'use strict';

/**
 * Creates a LatLonV point on spherical model earth.
 *
 * @classdesc Tools for working with points and paths on (a spherical model of) the earth’s surface
 *     using a vector-based approach using ‘n-vectors’ (rather than the more common spherical
 *     trigonometry; a vector-based approach makes most calculations much simpler, and easier to
 *     follow, compared with trigonometric equivalents).
 * @requires Geo
 *
 * @constructor
 * @param {number} lat - Latitude in degrees.
 * @param {number} lon - Longitude in degrees.
 * @param {number} [height=0] - Height above mean-sea-level in kilometres.
 * @param {number} [radius=6371] - Earth's mean radius in kilometres.
 *
 * @example
 *   var p1 = new LatLonV(52.205, 0.119);
 */
function LatLonV(lat, lon, height, radius) {
    // allow instantiation without 'new'
    if (!(this instanceof LatLonV)) return new LatLonV(lat, lon, height, radius);

    if (typeof height == 'undefined') height = 0;
    if (typeof radius == 'undefined') radius = 6371;
    radius = Math.min(Math.max(radius, 6353), 6384);

    this.lat    = Number(lat);
    this.lon    = Number(lon);
    this.height = Number(height);
    this.radius = Number(radius);
}

LatLonV.set = function( LatLon ) {
  return new LatLonV( LatLon.lat(), LatLon.lng());
}
/**
 * Converts ‘this’ lat/lon point to Vector3d n-vector (normal to earth's surface).
 *
 * @private
 * @returns {Vector3d} Normalised n-vector representing lat/lon point.
 *
 * @example
 *   var p = new LatLonV(45, 45);
 *   var v = p.toVector(); // v.toString(): [0.500,0.500,0.707]
 */
LatLonV.prototype.toVector = function() {
    var φ = this.lat.toRadians();
    var λ = this.lon.toRadians();

    // right-handed vector: x -> 0°E,0°N; y -> 90°E,0°N, z -> 90°N
    var x = Math.cos(φ) * Math.cos(λ);
    var y = Math.cos(φ) * Math.sin(λ);
    var z = Math.sin(φ);

    return new Vector3d(x, y, z);
};


/**
 * Converts ‘this’ n-vector to latitude/longitude point.
 *
 * @private
 * @returns  {LatLonV} Latitude/longitude point vector points to.
 *
 * @example
 *   var v = new Vector3d(0.500, 0.500, 0.707);
 *   var p = v.toLatLon(); // p.toString(): 45.0°N, 45.0°E
 */
Vector3d.prototype.toLatLon = function() {
    var φ = Math.atan2(this.z, Math.sqrt(this.x*this.x + this.y*this.y));
    var λ = Math.atan2(this.y, this.x);

    return new LatLonV(φ.toDegrees(), λ.toDegrees());
};


/**
 * Great circle obtained by heading on given bearing from ‘this’ point.
 *
 * @private
 * @param   {number}   bearing - Compass bearing in degrees.
 * @returns {Vector3d} Normalised vector representing great circle.
 *
 * @example
 *   var p1 = new LatLonV(53.3206, -1.7297);
 *   var gc = p1.greatCircle(96.0); // gc.toString(): [-0.794,0.129,0.594]
 */
LatLonV.prototype.greatCircle = function(bearing) {
    var φ = this.lat.toRadians();
    var λ = this.lon.toRadians();
    var θ = Number(bearing).toRadians();

    var x =  Math.sin(λ) * Math.cos(θ) - Math.sin(φ) * Math.cos(λ) * Math.sin(θ);
    var y = -Math.cos(λ) * Math.cos(θ) - Math.sin(φ) * Math.sin(λ) * Math.sin(θ);
    var z =  Math.cos(φ) * Math.sin(θ);

    return new Vector3d(x, y, z);
};


/**
 * Returns the distance from ‘this’ point to the specified point.
 *
 * @param   {LatLonV} point - Latitude/longitude of destination point.
 * @returns {number}  Distance between this point and destination point in km.
 *
 * @example
 *   var p1 = new LatLonV(52.205, 0.119), p2 = new LatLonV(48.857, 2.351);
 *   var d = p1.distanceTo(p2); // d.toPrecision(4): 404.3
 */
LatLonV.prototype.distanceTo = function(point) {
    var p1 = this.toVector();
    var p2 = point.toVector();

    var δ = p1.angleTo(p2);
    var d = δ * this.radius;

    return d;
};


/**
 * Returns the (initial) bearing from ‘this’ point to the specified point, in compass degrees.
 *
 * @param   {LatLonV} point - Latitude/longitude of destination point.
 * @returns {number}  Initial bearing in degrees from North (0°..360°).
 *
 * @example
 *   var p1 = new LatLonV(52.205, 0.119), p2 = new LatLonV(48.857, 2.351);
 *   var b1 = p1.bearingTo(p2); // b1.toFixed(1): 156.2
 */
LatLonV.prototype.bearingTo = function(point) {
    var p1 = this.toVector();
    var p2 = point.toVector();

    var northPole = new Vector3d(0, 0, 1);

    var c1 = p1.cross(p2);        // great circle through p1 & p2
    var c2 = p1.cross(northPole); // great circle through p1 & north pole

    // bearing is (signed) angle between c1 & c2
    var bearing = c1.angleTo(c2, p1).toDegrees();

    return (bearing+360) % 360; // normalise to 0..360
};


/**
 * Returns the midpoint between ‘this’ point and specified point.
 *
 * @param   {LatLonV} point - Latitude/longitude of destination point.
 * @returns {LatLonV} Midpoint between this point and destination point.
 *
 * @example
 *   var p1 = new LatLonV(52.205, 0.119), p2 = new LatLonV(48.857, 2.351);
 *   var pMid = p1.midpointTo(p2); // pMid.toString(): 50.5363°N, 001.2746°E
 */
LatLonV.prototype.midpointTo = function(point) {
    var p1 = this.toVector();
    var p2 = point.toVector();

    var mid = p1.plus(p2).unit();

    return mid.toLatLon();
};


/**
 * Returns the destination point from ‘this’ point having travelled the given distance on the
 * given initial bearing (bearing will normally vary before destination is reached).
 *
 * @param   {number}  bearing - Initial bearing in degrees.
 * @param   {number}  distance - Distance in km.
 * @returns {LatLonV} Destination point.
 *
 * @example
 *   var p1 = new LatLonV(51.4778, -0.0015);
 *   var p2 = p1.destinationPoint(300.7, 7.794); // p2.toString(): 51.5135°N, 000.0983°W
 */
LatLonV.prototype.destinationPoint = function(bearing, distance) {
    var δ = Number(distance) / this.radius; // angular distance in radians

    // get great circle obtained by starting from 'this' point on given bearing
    var c = this.greatCircle(bearing);

    var p1 = this.toVector();

    var x = p1.times(Math.cos(δ));          // component of p2 parallel to p1
    var y = c.cross(p1).times(Math.sin(δ)); // component of p2 perpendicular to p1

    var p2 = x.plus(y).unit();

    return p2.toLatLon();
};


/**
 * Returns the point of intersection of two paths each defined by point pairs or start point and bearing.
 *
 * @param   {LatLonV}        path1start - Start point of first path.
 * @param   {LatLonV|number} path1brngEnd - End point of first path or initial bearing from first start point.
 * @param   {LatLonV}        path2start - Start point of second path.
 * @param   {LatLonV|number} path2brngEnd - End point of second path or initial bearing from second start point.
 * @returns {LatLonV}        Destination point (null if no unique intersection defined)
 *
 * @example
 *   var p1 = LatLonV(51.8853, 0.2545), brng1 = 108.55;
 *   var p2 = LatLonV(49.0034, 2.5735), brng2 =  32.44;
 *   var pInt = LatLonV.intersection(p1, brng1, p2, brng2); // pInt.toString(): 50.9078°N, 004.5084°E
 */
LatLonV.intersection = function(path1start, path1brngEnd, path2start, path2brngEnd) {
    var c1, c2;
    if (path1brngEnd instanceof LatLonV) { // path 1 defined by endpoint
        c1 = path1start.toVector().cross(path1brngEnd.toVector());
    } else {                               // path 1 defined by initial bearing
        c1 = path1start.greatCircle(path1brngEnd);
    }
    if (path2brngEnd instanceof LatLonV) { // path 2 defined by endpoint
        c2 = path2start.toVector().cross(path2brngEnd.toVector());
    } else {                               // path 2 defined by initial bearing
        c2 = path2start.greatCircle(path2brngEnd);
    }

    var intersection = c1.cross(c2);

    return intersection.toLatLon();
};


/**
 * Returns (signed) distance from ‘this’ point to great circle defined by start-point and end-point/bearing.
 *
 * @param   {LatLonV}        pathStart - Start point of great circle path.
 * @param   {LatLonV|number} pathBrngEnd - End point of great circle path or initial bearing from great circle start point.
 * @returns {number}         Distance to great circle (-ve if to left, +ve if to right of path).
 *
 * @example
 *   var pCurrent = new LatLonV(53.2611, -0.7972);
 *
 *   var p1 = new LatLonV(53.3206, -1.7297), brng = 96.0;
 *   var d = pCurrent.crossTrackDistanceTo(p1, brng);// d.toPrecision(4): 0.3354
 *
 *   var p1 = new LatLonV(53.3206, -1.7297), p2 = new LatLonV(53.1883, 0.1333);
 *   var d = pCurrent.crossTrackDistanceTo(p1, p2);  // d.toPrecision(4): 0.3354
 */
LatLonV.prototype.crossTrackDistanceTo = function(pathStart, pathBrngEnd) {
    var p = this.toVector();

    var gc;
    if (pathBrngEnd instanceof LatLonV) {
        // great circle defined by two points
        var pathEnd = pathBrngEnd;
        gc = pathStart.toVector().cross(pathEnd.toVector());
    } else {
        // great circle defined by point + bearing
        var pathBrng = Number(pathBrngEnd);
        gc = pathStart.greatCircle(pathBrng);
    }

    var α = gc.angleTo(p, p.cross(gc)); // (signed) angle between point & great-circle normal vector
    α = α<0 ? -Math.PI/2 - α : Math.PI/2 - α; // (signed) angle between point & great-circle

    var d = α * this.radius;

    return d;
};


/**
 * Tests whether ‘this’ point is enclosed by the (convex) polygon defined by a set of points.
 *
 * @param   {LatLonV[]} points - Ordered array of points defining vertices of polygon.
 * @returns {bool}      Whether this point is enclosed by region.
 * @throws  {Error}     If polygon is not convex.
 *
 * @example
 *   var bounds = [ new LatLonV(45,1), new LatLonV(45,2), new LatLonV(46,2), new LatLonV(46,1) ];
 *   var p = new LatLonV(45,1, 1.1);
 *   var inside = p.enclosedBy(bounds); // inside: true;
 */
LatLonV.prototype.enclosedBy = function(points) {
    var v = this.toVector(); // vector to 'this' point

    // if fully closed polygon, pop last point off array
    if (points[0].equals(points[points.length-1])) points.pop();

    // get great-circle vector for each segment
    var c = [];
    for (var n=0; n<points.length; n++) {
        var p1 = points[n].toVector();
        var p2 = points[n+1==points.length ? 0 : n+1].toVector();
        c[n] = p1.cross(p2); // great circle for segment n
    }

    // is 'this' point on same side of each segment? (left/right depending on (anti-)clockwise)
    var toLeft0 = c[0].angleTo(v) <= Math.PI/2; // 'this' point to left of first segment?
    for (var n=1; n<points.length; n++) {
        var toLeftN = c[n].angleTo(v) <= Math.PI/2; // 'this' point to left of segment n?
        if (toLeft0 != toLeftN) return false;
    }

    // is polygon convex? (otherwise above test is not reliable)
    for (var n=0; n<points.length; n++) {
        var c1 = c[n];
        var c2 = c[n+1==points.length ? 0 : n+1];
        var α = c1.angleTo(c2, v); // angle between great-circle vectors, signed by direction of v
        if (α < 0) throw new Error('Polygon is not convex');
    }

    return true;
};


/**
 * Returns point representing geographic mean of supplied points.
 *
 * @param   {LatLonV[]} points - Array of points to be averaged.
 * @returns {LatLonV}   Point at the geographic mean of the supplied points.
 * @todo Not yet tested.
 */
LatLonV.meanOf = function(points) {
    var m = new Vector3d(0, 0, 0);

    // add all vectors
    for (var p=0; p<points.length; p++) {
        m = m.plus(points[p].toVector());
    }

    // m is now geographic mean
    return m.unit().toLatLon();
};


/**
 * Checks if another point is equal to ‘this’ point.
 *
 * @private
 * @param   {LatLonV} point - Point to be compared against this point.
 * @returns {bool}    True if points are identical.
 *
 * @example
 *   var p1 = new LatLonV(52.205, 0.119), p2 = new LatLonV(52.205, 0.119);
 *   var equal = p1.equals(p2); // equals: true
 */
LatLonV.prototype.equals = function(point) {
    if (this.lat != point.lat) return false;
    if (this.lon != point.lon) return false;
    if (this.height != point.height) return false;
    if (this.radius != point.radius) return false;

    return true;
};


/**
 * Returns a string representation of ‘this’ point.
 *
 * @param   {string} [format=dms] - Format point as 'd', 'dm', 'dms'.
 * @param   {number} [dp=0|2|4] - Number of decimal places to use: default 0 for dms, 2 for dm, 4 for d.
 * @returns {string} Comma-separated formatted latitude/longitude.
 */
LatLonV.prototype.toString = function(format, dp) {
    if (typeof format == 'undefined') format = 'dms';

    return Geo.toLat(this.lat, format, dp) + ', ' + Geo.toLon(this.lon, format, dp);
};


/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */

/** Extend Number object with method to convert numeric degrees to radians */
if (typeof Number.prototype.toRadians == 'undefined') {
    Number.prototype.toRadians = function() { return this * Math.PI / 180; };
}

/** Extend Number object with method to convert radians to numeric (signed) degrees */
if (typeof Number.prototype.toDegrees == 'undefined') {
    Number.prototype.toDegrees = function() { return this * 180 / Math.PI; };
}

/** Extend Math object to test the sign of a number, indicating whether it's positive, negative or zero */
if (typeof Math.sign == 'undefined') {
    // stackoverflow.com/questions/7624920/number-sign-in-javascript
    Math.sign = function(x) {
        return typeof x == 'number' ? x ? x < 0 ? -1 : 1 : x === x ? 0 : NaN : NaN;
    };
}

/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */
/*  Vector handling functions                                         (c) Chris Veness 2011-2014  */
/*                                                                                                */
/*  These are generic 3-d vector manipulation routines.                                           */
/*                                                                                                */
/*  In a geodesy context, these may be used to represent:                                         */
/*   - n-vector representing a normal to point on Earth's surface                                 */
/*   - earth-centered, earth fixed vector (= n-vector for spherical model)                        */
/*   - great circle normal to vector                                                              */
/*   - motion vector on Earth's surface                                                           */
/*   - etc                                                                                        */
/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */

/* jshint node:true *//* global define */
'use strict';


/**
 * Creates a 3-d vector.
 *
 * The vector may be normalised, or use x/y/z values for eg height relative to the sphere or
 * ellipsoid, distance from earth centre, etc.
 *
 * @classdesc Tools for manipulating 3-d vectors, to support various latitude/longitude functions.
 *
 * @constructor
 * @param {number} x - X component of vector.
 * @param {number} y - Y component of vector.
 * @param {number} z - Z component of vector.
 */
function Vector3d(x, y, z) {
    // allow instantiation without 'new'
    if (!(this instanceof Vector3d)) return new Vector3d(x, y, z);

    this.x = Number(x);
    this.y = Number(y);
    this.z = Number(z);
}


/**
 * Adds supplied vector to ‘this’ vector.
 *
 * @param   {Vector3d} v - Vector to be added to this vector.
 * @returns {Vector3d} Vector representing sum of this and v.
 */
Vector3d.prototype.plus = function(v) {
    return new Vector3d(this.x + v.x, this.y + v.y, this.z + v.z);
};


/**
 * Subtracts supplied vector from ‘this’ vector.
 *
 * @param   {Vector3d} v - Vector to be subtracted from this vector.
 * @returns {Vector3d} Vector representing difference between this and v.
 */
Vector3d.prototype.minus = function(v) {
    return new Vector3d(this.x - v.x, this.y - v.y, this.z - v.z);
};


/**
 * Multiplies ‘this’ vector by a scalar value.
 *
 * @param   {number}   x - Factor to multiply this vector by.
 * @returns {Vector3d} Vector scaled by x.
 */
Vector3d.prototype.times = function(x) {
    x = Number(x);
    return new Vector3d(this.x * x, this.y * x, this.z * x);
};


/**
 * Divides ‘this’ vector by a scalar value.
 *
 * @param   {number}   x - Factor to divide this vector by.
 * @returns {Vector3d} Vector divided by x.
 */
Vector3d.prototype.dividedBy = function(x) {
    x = Number(x);
    return new Vector3d(this.x / x, this.y / x, this.z / x);
};


/**
 * Multiplies ‘this’ vector by the supplied vector using dot (scalar) product.
 *
 * @param   {Vector3d} v - Vector to be dotted with this vector.
 * @returns {number} Dot product of ‘this’ and v.
 */
Vector3d.prototype.dot = function(v) {
    return this.x*v.x + this.y*v.y + this.z*v.z;
};


/**
 * Multiplies ‘this’ vector by the supplied vector using cross (vector) product.
 *
 * @param   {Vector3d} v - Vector to be crossed with this vector.
 * @returns {Vector3d} Cross product of ‘this’ and v.
 */
Vector3d.prototype.cross = function(v) {
    var x = this.y*v.z - this.z*v.y;
    var y = this.z*v.x - this.x*v.z;
    var z = this.x*v.y - this.y*v.x;

    return new Vector3d(x, y, z);
};


/**
 * Negates a vector to point in the opposite direction
 *
 * @returns {Vector3d} Negated vector.
 */
Vector3d.prototype.negate = function() {
    return new Vector3d(-this.x, -this.y, -this.z);
};


/**
 * Length (magnitude or norm) of ‘this’ vector
 *
 * @returns {number} Magnitude of this vector.
 */
Vector3d.prototype.length = function() {
    return Math.sqrt(this.x*this.x + this.y*this.y + this.z*this.z);
};


/**
 * Normalizes a vector to its unit vector
 * – if the vector is already unit or is zero magnitude, this is a no-op.
 *
 * @returns {Vector3d} Normalised version of this vector.
 */
Vector3d.prototype.unit = function() {
    var norm = this.length();
    if (norm == 1) return this;
    if (norm == 0) return this;

    var x = this.x/norm;
    var y = this.y/norm;
    var z = this.z/norm;

    return new Vector3d(x, y, z);
};


/**
 * Calculates the angle between ‘this’ vector and supplied vector.
 *
 * @param   {Vector3d} v
 * @param   {Vector3d} [vSign] - If supplied (and out of plane of this and v), angle is signed +ve if
 *     this->v is clockwise looking along vSign, -ve in opposite direction (otherwise unsigned angle).
 * @returns {number} Angle (in radians) between this vector and supplied vector.
 */
Vector3d.prototype.angleTo = function(v, vSign) {
    var sinθ = this.cross(v).length();
    var cosθ = this.dot(v);

    if (typeof vSign != 'undefined') {
        // use vSign as reference to get sign of sinθ
        sinθ = this.cross(v).dot(vSign)<0 ? -sinθ : sinθ;
    }

    return Math.atan2(sinθ, cosθ);
};


/**
 * Rotates ‘this’ point around an axis by a specified angle.
 *
 * @param   {Vector3d} axis - The axis being rotated around.
 * @param   {number}   theta - The angle of rotation (in radians).
 * @returns {Vector3d} The rotated point.
 */
Vector3d.prototype.rotateAround = function(axis, theta) {
    // en.wikipedia.org/wiki/Rotation_matrix#Rotation_matrix_from_axis_and_angle
    // en.wikipedia.org/wiki/Quaternions_and_spatial_rotation#Quaternion-derived_rotation_matrix
    var p1 = this.unit();
    var p = [ p1.x, p1.y, p1.z ]; // the point being rotated
    var a = axis.unit();          // the axis being rotated around
    var s = Math.sin(theta);
    var c = Math.cos(theta);
    // quaternion-derived rotation matrix
    var q = [ [ a.x*a.x*(1-c) + c,     a.x*a.y*(1-c) - a.z*s, a.x*a.z*(1-c) + a.y*s],
              [ a.y*a.x*(1-c) + a.z*s, a.y*a.y*(1-c) + c,     a.y*a.z*(1-c) - a.x*s],
              [ a.z*a.x*(1-c) - a.y*s, a.z*a.y*(1-c) + a.x*s, a.z*a.z*(1-c) + c    ] ];
    // multiply q × p
    var qp = [0, 0, 0];
    for (var i=0; i<3; i++) {
        for (var j=0; j<3; j++) {
            qp[i] += q[i][j] * p[j];
        }
    }
    var p2 = new Vector3d(qp[0], qp[1], qp[2]);
    return p2;
    // qv en.wikipedia.org/wiki/Rodrigues'_rotation_formula...
};


/**
 * String representation of vector.
 *
 * @param   {number} [precision=3] - Number of decimal places to be used.
 * @returns {string} Vector represented as [x,y,z].
 */
Vector3d.prototype.toString = function(precision) {
    if (typeof precision == 'undefined') precision = 3;

    var p = Number(precision);

    var str = '[' + this.x.toFixed(p) + ',' + this.y.toFixed(p) + ',' + this.z.toFixed(p) + ']';

    return str;
};