/*
MARGEE Moving and Rotating Google Earth Elements
Authors: Mladen M. Dordevic, Steven J. Whitmeyer
James Madison University
contact whitmesj@jmu.edu
 */
"use strict";
var MARGEE = ( function($, _g, document, window, work ) {
	"use strict";
	var _map = null,
		_grid = null,
		_selected = [],
		_obj = {},
		_endTranslateMarker = null,
		_startTranslateMarker = null,
		_translationLine = null,
		_sessionId = randStr(10),
		_eulerPoleMarker = null,
		_jobStac = [null];

	/**
	 * Checks if input is a Number
	 * @method isNumber
	 * @param {} num
	 * @return {Boolean}
	 */
	function isNumber( num ) {
		var n = parseFloat( num );
		return !isNaN( n ) && isFinite( n );
	};

	/**
	 * Takes file name and extension from input form and generates a download file
	 * @method download
	 */
	function download() {
		var filename = $("#downloadName").val() || 'root';
		var fileType = $('[name=file-extension]:checked').val();
		if (fileType == 'kmz') {
			var zip = new JSZip();
			zip.file("doc.kml", objToKml());
			saveAs( zip.generate({type:"blob", compression : 'DEFLATE'}) , filename + ".kmz");
		}
		if (fileType == 'kml') {
			saveAs(new Blob( [objToKml()] ) , filename + ".kml");
		}
	};

	/**
	 * Converts Object containing KML geometries to KML string
	 * @method objToKml
	 * @return {String} xml
	 */
	function objToKml() {
		var doc = new XMLWriter('UTF-8');
		doc.writeStartDocument( );
		doc.writeStartElement( 'kml' );
		doc.writeAttributeString( "xmlns", "http://www.opengis.net/kml/2.2" );
		doc.writeStartElement('Document');

		//create styles
		for( var i in _obj ) {
			var m = _obj[i];
			if ( m.parent == '' ) {
				doc.writeStartElement( 'Style' );
				doc.writeAttributeString( 'id', m.id );
				if ( m.type == 'Marker' ) {
					doc.writeStartElement('IconStyle');
						doc.writeStartElement('Icon');
							doc.writeElementString('href', m.icon );
						doc.writeEndElement();
					doc.writeEndElement();
				}
				if ( m.type == 'Polyline' || m.type == 'Polygon' ) {
					doc.writeStartElement('LineStyle');
						doc.writeElementString('color', earthToMapsColor( false, m.strokeColor, m.strokeOpacity ).color || 'ffFF0000' );
						doc.writeElementString('width', m.strokeWidth || 1 );
					doc.writeEndElement();
				}
				if ( m.type == 'Polygon' ) {
					doc.writeStartElement('PolyStyle');
						doc.writeElementString('color', earthToMapsColor( false, m.fillColor, m.fillOpacity ).color || 'ffFF0000');
					doc.writeEndElement();
				}
				doc.writeEndElement();
			}
		}

		for( var i in _obj ) {
			var m = _obj[i];
			var coor = getLatLngArray( m );
			var coorString = '';

			doc.writeStartElement('Placemark');
			doc.writeStartElement('name');
			doc.writeCDATA( m.name );
			doc.writeEndElement();
			if ( m.animation ) {
				doc.writeStartElement('TimeSpan');
					doc.writeElementString('begin', m.animation.begin);
					doc.writeElementString('end', m.animation.end);
				doc.writeEndElement();
			}
			doc.writeElementString('styleUrl', ('#' + (m.parent || m.id)) );
			if ( m.type == "Marker" ) {
				doc.writeStartElement('Point');
				doc.writeElementString('extrude', '1');
				doc.writeElementString('altitudeMode', 'clampToGround');
				doc.writeElementString('coordinates', m.getPosition().lng() + "," + m.getPosition().lat() +",0");
				doc.writeEndElement();

			}else if( m.type == "Polygon" ) {
				doc.writeStartElement('Polygon');
					doc.writeElementString('extrude', '1');
					doc.writeElementString('altitudeMode', 'clampToGround');
					doc.writeStartElement('outerBoundaryIs');
						doc.writeStartElement('LinearRing');
							doc.writeStartElement( "coordinates" );
				for( var j=0; j <coor.length; j++ ){
								coorString += coor[j].lng() + "," + coor[j].lat() + ",0 ";
				}
								doc.writeString( coorString );
							doc.writeEndElement();
						doc.writeEndElement();
					doc.writeEndElement();
				doc.writeEndElement();

			}else if( m.type == "Polyline" ){
				doc.writeStartElement('LineString');
					doc.writeElementString('extrude', '1');
					doc.writeElementString('altitudeMode', 'clampToGround');
					doc.writeStartElement( "coordinates" );
				for( var j=0; j < coor.length; j++ ){
						coorString += coor[j].lng() + "," + coor[j].lat() + ",0 ";
				}
						doc.writeString( coorString );
					doc.writeEndElement();
				doc.writeEndElement();
			}
			doc.writeEndElement();
		}
		doc.writeEndElement();
		doc.writeEndElement();
		doc.writeEndDocument();

		var xml = doc.flush();
		doc.close();
		return xml;
	};

	/**
	 * Return a random string of specified length
	 * @method randStr
	 * @param {Number} len: Length of a string
	 * @return {String} text
	 */
	function randStr( len ) {
		var text = "";
		var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

		for( var i=0; i < len; i++ )
			text += possible.charAt(Math.floor(Math.random() * possible.length));
		return text;
	};

	var uid = (function () {
		var id = 0;
		return function(){
			return _sessionId + '_' + id++;
		}
	})();

	/**
	 * Updates options available for the user based upon selection of shapes
	 * @method updateFunctionalityUponSelect
	 */
	function updateFunctionalityUponSelect() {
		var sel = _selected;
		if ( sel.length > 0 ) {
			$('#findEuler-but').attr('disabled', true);
			$('#toggle-visibility').attr('disabled', false);
			$('#delete-shapes').attr('disabled', false);
			$('#rotateAroundCentroid').attr('disabled', false);
			$('#rotateSelected').attr('disabled', false);
			$('#translateAroundCentroid').attr('disabled', false);
			$('#translateSelected').attr('disabled', false);
			$('#simplifyObj').attr('disabled', false);
			$('#batch').attr('disabled', false);
			$("#sol-all").hide();

			if ( sel.length == 1 ) {
				//check if selected is polygon or line, if it is, enable edit
				if(	sel[0].type == "Polygon" || sel[0].type == "Polyline" ) {
					$('#editSelectedPolygon').attr('disabled', false);
					$('#colorList').attr('disabled', false);
				}
			} else {
				$('#editSelectedPolygon').attr('disabled', true);
				$('#colorList').attr('disabled', true);
			}
		}

		if(sel.length == 0){
			//disable everything
			$('#rotateAroundCentroid').attr('disabled', true);
			$('#rotateSelected').attr('disabled', true);
			$('#translateAroundCentroid').attr('disabled', true);
			$('#translateSelected').attr('disabled', true);
			$('#simplifyObj').attr('disabled', true);
			$('#editSelectedPolygon').attr('disabled', true);
			$('#colorList').attr('disabled', true);
			$('#findEuler-but').attr('disabled', true);
			$('#toggle-visibility').attr('disabled', true);
			$('#delete-shapes').attr('disabled', true);
			$('#batch').attr('disabled', true);

			$("#sol-all").hide();
		}
		if(sel.length == 2){
			$('#findEuler-but').attr('disabled', false);
		}
	};

	/**
	 * Converts input text to states and executes them one by one
	 * @method batch
	 */
	function batch( ) {
		var text = $("#batchString").val();
		var cleanText = text.replace(/[^0-9.rt\-\n]/g, ' ').replace(/^\s*/gm,'').replace(/\s*$/gm, '').replace(/\s\s+/g, ' ')
		$("#batchString").val( cleanText );
		var lines = cleanText.split('\n');

		lines.forEach( function ( l ) {
			if ( !l.match(/^[rt]/) ) {
				alertModal ('No operation defined. Try:\n r lat lon angle for rotation in decimal degrees \n or: \nt heading distance in decimal degrees and meeter for translation ');
				return;
			}

			var arg = l.split(' ');
			var n = isNumber(arg[4])? arg[4] : 0;
			var s = isNumber(arg[5])? arg[5] : 0;
			var e = isNumber(arg[6])? arg[6] : 0;
			$('#steps').val( n );
			$('#startSt').val( s );
			$('#stopSt').val( e );
			if( s == e ) {
				$('#animate').prop('checked', false);
			} else {
				$('#animate').prop('checked', true);
			}

			if ( arg[0] == 'r' ) {
				var lat = isNumber(arg[1])? arg[1] : null;
				var lon = isNumber(arg[2])? arg[2] : null;
				var rot = isNumber(arg[3])? arg[3] : null;

				if ( lat == null ) {
					alertModal('Error in line:' +  i + '\n second argument expected to be latitude in decimal degrees.');
					return;
				}
				if ( lon == null ) {
					alertModal('Error in line:' +  i + '\n third argument expected to be longitude in decimal degrees.');
					return;
				}
				if ( rot == null ) {
					alertModal('Error in line:' +  i + '\n fourth argument expected to be rotation angle in decimal degrees.');
					return;
				}
				$('#polLatitude').val( lat );
				$('#polLongitude').val( lon );
				$('#azimuth').val( rot );
				doSomething('r');
			} else if ( arg[0] == 't' ) {
				var heading = isNumber(arg[1])? arg[1] : null;
				var distance = isNumber(arg[2])? arg[2] : null;
				if ( heading == null ) {
					alertModal('Error in line:' +  i + '\n second argument expected to be heading in decimal degrees.');
					return;
				}
				if ( distance == null ) {
					alertModal('Error in line:' +  i + '\n third argument expected to be distance in km.');
					return;
				}
				$('#translateDistance').val( distance );
				$('#translHeading').val( heading );
				doSomething('t');
			} else {
				alert ('No operation defined. Try:\n r lat lon angle for rotation in decimal degrees \n or: \nt heading distance in decimal degrees and meeter for translation ')
			}
		});
	};

	/**
	 * Finds Euler pole location and azimuth given initial and final state
	 * @method findEuler
	 */
	function findEuler () {
		var sel = _selected;

		if ( sel.length !== 2 ) {
			alertModal("You have to select two and only two features.");
			return;
		}
		var e1 = sel[ 0 ];
		var e2 = sel[ 1 ];

		if ( e1.type !== e2.type ) {
			alertModal("You have to select two feature of the same type.");
			return;
		}

		var e1Cor = getLatLngArray(e1);
		var e2Cor = getLatLngArray(e2);
		var ln = e1Cor.length;

		if ( ln !== e2Cor.length ) {
			alertModal("Selected feature do not match in number of points");
			return;
		}
		if ( ln < 3 ) {
			alertModal("At least polygon/path with 3 points needs to be selected");
			return;
		}
		//checking fixed bearings before and after translation in point pairs
		var sol = []
		var v1s = LatLonV.set(e1Cor[0]);
		var v1e = LatLonV.set(e2Cor[0]);

		var v2s = LatLonV.set(e1Cor[3]);
		var v2e = LatLonV.set(e2Cor[3]);

		var v2m = v2s.midpointTo(v2e);
		var v2b = v2m.bearingTo(v2e);

		var v1m = v1s.midpointTo(v1e);
		var v1b = v1m.bearingTo(v1e);

		var s = LatLonV.intersection(v1m, v1b + 90, v2m, v2b + 90);
		var s2 = LatLonV( -s.lat, ( s.lon + 360 + 180 ) % 360);

		if ( s2.lon > 180 ) {
			s2.lon = s2.lon - 360;
		}
		var ang = s.bearingTo(v1s) - s.bearingTo(v1e);
		s.az = ang;
		s2.az = -ang;

		$("#sol-all").show();

		$("#sol-one").on("click", function(){
			$("#polLatitude").val(parseFloat($("#sol-one-lat").val()).toFixed(6));
			$("#polLongitude").val(parseFloat($("#sol-one-lon").val()).toFixed(6));
			$("#azimuth").val(parseFloat($("#sol-one-az").val()).toFixed(3));
			updatePol();
		});

		$("#sol-two").on("click", function(){
			$("#polLatitude").val(parseFloat($("#sol-two-lat").val()).toFixed(6));
			$("#polLongitude").val(parseFloat($("#sol-two-lon").val()).toFixed(6));
			$("#azimuth").val(parseFloat($("#sol-two-az").val()).toFixed(3));
			updatePol();
		});

		$("#sol-one-lat").val(s.lat).text(s.lat.toFixed(2));
		$("#sol-one-lon").val(s.lon).text(s.lon.toFixed(2));
		$("#sol-one-az").val(s.az).text(s.az.toFixed(1));

		$("#sol-two-lat").val(s2.lat).text(s2.lat.toFixed(2));
		$("#sol-two-lon").val(s2.lon).text(s2.lon.toFixed(2));
		$("#sol-two-az").val(s2.az).text(s2.az.toFixed(1));
	};

	/**
	 * Convert rrggbb to bbggrr
	 * @method earthToMapsColor
	 * @param {Boolean} direct
	 * @param {String} str
	 * @param {Number} opacity
	 * @return { color : String, opacity: String}
	 */
	function earthToMapsColor ( direct, str, opacity ) {
		if ( direct ) {
			return {
				color : '#' + str.substring(6, 8) + str.substring(4, 6) + str.substring(2, 4),
				opacity : parseInt( str.substring(0, 2), 16 ) / 255,
			}
		} else {
			str = str.substring(1);
			var opacity = ( opacity * 255 ).toString(16);
			return {
				color : opacity + str.substring(6, 4) + str.substring(4, 2) + str.substring(2, 0),
				opacity : opacity
			}
		}
	};

	/**
	 * Read a content of selected file based upon its extension
	 * @method readInFile
	 * @param {} evt: Event fired by the element
	 */
	function readInFile ( evt ) {
		if (window.File && window.FileReader && window.FileList && window.Blob) {
			var f = evt.target.files[0];
			var type = f.type;
			var extension = f.name.slice(f.name.length -3, f.name.length).toLowerCase();
			var fileReader = new FileReader();
			if (f && (type === "application/vnd.google-earth.kml+xml" || extension === "kml") ){
				fileReader.onload = function(e){
					var string = e.target.result;
					var d = $.parseXML(string);
					renderXml( d );
					$('#fileinput').val('');
					$("html, body").animate({ scrollTop: 0 }, "slow");
				}
				fileReader.readAsText(f);
			}
			else if (f && (type === "application/vnd.google-earth.kmz" || extension === "kmz") ){

				fileReader.onload = function(e){
					var dinString = e.target.result;
					var kmz = new JSZip();
					kmz.load(dinString);
					var string = kmz.file("doc.kml").asText();
					var d = $.parseXML(string);
					renderXml( d );
					$('#fileinput').val('');
				}
				fileReader.readAsBinaryString(f);
			}
			else {
				alertModal("Failed to load file, or not KML file type.");
			}
		}
		else {
			alertModal('The File APIs are not fully supported by your browser.');
		}
	};

	/**
	 * Grabs the style from KML and sets it to the Google Map shape
	 * @method setKmlStyle
	 * @param {} shape: Google maps Point || Polygon || Polyline
	 * @param {String} xml: Loaded KML content
	 * @param {String} self: Shape being styled
	 * @return
	 */
	function setKmlStyle ( shape, xml, self ) {
		var type = shape.type;
		var styleUrl = $(self).find('styleUrl').text().substring(1);
		var styleId = $(xml.getElementById( styleUrl )).find('Pair:first').find('styleUrl').text().substring(1);
		var style = $(xml.getElementById( styleId ));

		if ( type == 'Marker' ) {
			var ico = style.find('IconStyle').find('Icon').find('href').text();
			shape.setOptions({icon : icon});
		}
		if ( type == 'Polyline' || type == 'Polygon' ) {
			var strokeColor = style.find('LineStyle').find('color').text() || 'ffFF0000';
			var strokeWidth = style.find('LineStyle').find('width').text() || 0.8;
			shape.setOptions({
				strokeColor : earthToMapsColor( true, strokeColor).color,
				strokeWidth : strokeWidth,
				strokeOpacity : earthToMapsColor( true, strokeColor).opacity
			});
		}
		if ( type == 'Polygon' ) {
			var fillColor = style.find('PolyStyle').find('color').text() || 'ffFF0000';
			shape.setOptions({
				fillColor : earthToMapsColor( true, fillColor).color,
				fillOpacity : earthToMapsColor( true, fillColor).opacity
			});
		}
	};

	/**
	 * Shows KML geometry in Google Maps
	 * @method renderXml
	 * @param {String} xml: Loaded KML
	 */
	function renderXml( xml ) {
		var x = $(xml);
		function initObj( shape, type, id, self ) {
			_obj[id] = shape;
			_obj[id].id = id;
			_obj[id].name = $(self).find('name').text();
			_obj[id].type = type;
			_obj[id].children = [];
			_obj[id].setMap( _map );
			_obj[id].parent = '';

			_g.event.addListener(shape, 'mouseover', function() {
				$( '#' + shape.id ).addClass('mouse-over');
			});
			_g.event.addListener(shape, 'mouseout', function() {
				$( '#' + shape.id ).removeClass('mouse-over');
			});

			$('#kml-items-helper').slideUp();
			$("#kmlItems").append(
				$('<li class="ui-widget-content">').attr('id', id).append(
					$(self).find('name').text()
				)
			);
		};

		x.find('Placemark').each( function( ) {
			var id = uid();
			//Point
			if ( $(this).find('Point').length > 0 ) {
				var c = $(this).find('coordinates').text();
				var s = new _g.Marker({
					position: stringToLatLngArray( c )[0],
				});
				initObj( s, 'Marker', uid(), this );
			}

			//LineString
			if ( $(this).find('LineString').length > 0  ) {
				var c = $(this).find('coordinates').text();

				var s = new _g.Polyline( {
					path: stringToLatLngArray( c ),
					geodesic: true,
				});
				initObj( s, 'Polyline', uid(), this );
				setKmlStyle( s, xml, this );
			}

			//Polygon
			if ( $(this).find('Polygon').length > 0  ) {
				var c = $(this).find('coordinates').text();
				var s = new _g.Polygon({
					paths: stringToLatLngArray( c ),
					geodesic: true,
				});
				initObj( s, 'Polygon', uid(), this );
				setKmlStyle( s, xml, this );
			}
		});
		$( "#kmlItems" ).selectable('refresh');
	};

	/**
	 * Return a length of an object
	 * @method objLenght
	 * @param {Object} obj
	 * @return {Number} length
	 */
	function objLenght( obj ) {
		var length = 0;
		for ( var i in obj ) {
			length++;
		}
		return	length;
	};

	/**
	 * Description
	 * @method stringToLatLngArray
	 * @param {String} str: KML style coordinates
	 * @return Array[LatLng] res
	 */
	function stringToLatLngArray( str ) {
		var res = [];
		str = str.replace(/[^0-9\- .,]/g, '').replace(/^\s\s*/, '').replace(/\s\s*$/, '');
		var strArray = str.split(' ');
		strArray.forEach( function ( n ) {
			var coor = n.split(',');
			var latLng = new _g.LatLng( coor[1] * 1, coor[0] * 1 );
			res.push( latLng );
		});
		return res;
	};

	/**
	 * Displays alert modal
	 * @method alertModal
	 * @param {String} message
	 */
	function alertModal( message ) {
		$('#alert-modal-text').text( message );
		$('#alert-modal').modal('show');
	};

	/**
	 * Action function that performs rotation translation, simplification
	 * @method doSomething
	 * @param {String} operationType
	 * @param {Boolean} undoing Should action skip undo or not
	 */
	function doSomething ( operationType, undoing ) {
		var distance = $('#translateDistance').val() * 1;
		var azimuth = $('#azimuth').val() * 1;
		var steps = parseInt( $("#steps").val() ) + 1;
		var animation = !!$('#animate:checked').length;
		var start = $('#startSt').val() * -1;
		var stop = $("#stopSt").val() * -1;
		var data = {
			tra	: operationType,
			latPol : $('#polLatitude').val() * 1,
			lonPol : $('#polLongitude').val() * 1,
			azimuth : azimuth,
			bearing : $('#translHeading').val() * 1,
			distance : distance,
			kink : $('#simplificationKink').val() * 1000,
		};

		function setFrame( shape, step ) {
			if ( animation ) {
				var timeStep = Math.abs(start - stop) / steps;
				var begin = start + timeStep * step;
				var end = start + timeStep * (step + 1);
				//To enable animation to go bidirectional
				if( start > stop ) {
					begin = start - timeStep * step;
					end = start - timeStep * (step + 1);
				}

				var month = Math.ceil(12 * (begin - Math.floor(begin)));
				month = month > 9? month : '0' + month;
				begin = Math.floor(begin) + '-' + month + '-01';

				month = Math.ceil(12 * (end - Math.floor(end)));
				month = month > 9? month : '0' + month;
				end = Math.floor(end) + '-' + month + '-01';
				shape.animation = {};

				if(start > stop){
					shape.animation.begin = end;
					shape.animation.end = begin;
				}
				else{
					shape.animation.begin = begin;
					shape.animation.end = end;
				}
			}
		};

		if ( start - stop == 0 && animation) {
			alertModal( 'Can\'t have same numbers for start and stop Intermediate Steps.');
			return;
		}
		if ( steps == 1 && animation) {
			alertModal( 'Can\'t have Number of steps 0 in Intermediate Steps.');
			return;
		}
		if ( steps > 50 ) {
			alertModal('Number of steps to large in Intermediate Steps. Use up to 50 steps.');
			return
		}

		var undo = curentState();
		undo.action = operationType;
		undo.more = [];

		//MAIN ITERATION LOOP
		_selected.forEach( function ( shape ) {
			undo.id = shape.id;
			data.arrayLat = [];
			data.arrayLon = [];
			getLatLngArray( shape ).forEach( function ( LatLng ) {
				data.arrayLat.push( LatLng.lat() );
				data.arrayLon.push( LatLng.lng() );
			});

			if ( steps != 1 ) {
				for ( var step = 0; step < steps; step++ ) {
					data.azimuth = ( azimuth / steps ) * step;
					data.distance = ( distance / steps ) * step;
					res = work( data );
					var s = duplicateShape( shape );
					setCoordinates( s, res );
					setFrame( s, step );
					undo.more.push(s.id);
					_obj[s.id] = s;
				}
			}

			data.azimuth = azimuth;
			data.distance = distance;
			var res = work( data );
			setCoordinates( shape, res );
			setFrame( shape, steps );
		});
		updateTranslationHelpers();
		if ( undoing != true && operationType != 's') {
			_jobStac.push( undo );
		}
	};

	/**
	 * Undo feature
	 * @method undo
	 * @param {Boolean} undo: Should it undo or re-undo
	 */
	function undo( undo ) {
		if ( undo ) {
			if ( _jobStac.slice(-1)[0] != null ) {
				var state = _jobStac.pop();
				_jobStac.unshift( state );

				state.more.forEach( function ( id ) {
					_obj[id].setMap( null );
					delete _obj[id];
				});

				curentState( {
					latPol : state.latPol,
					lonPol : state.lonPol,
					azimuth : -state.azimuth,
					bearing : state.bearing,
					distance : -state.distance,
					kink : state.kink,
					steps : 0,
					start : 0,
					stop : 0,
					animation : false
				} );
				doSomething( state.action, true);
				curentState( state );
			} else {
				alertModal('Nothing to undo.');
			}
		}
		if ( !undo ) {
			if ( _jobStac[0] != null ) {
				var state = _jobStac.shift();
				curentState( state );
				doSomething( state.action );
			} else {
				alertModal('Nothing to redo.');
			}
		}
	};

	/**
	 * Sets the some state to all user input values
	 * @method curentState
	 * @param {Object} set
	 * @return {Object} current state
	 */
	function curentState( set ) {
		if ( set ) {
			$('#polLatitude').val( set.latPol );
			$('#polLongitude').val( set.lonPol );
			$('#azimuth').val( set.azimuth );
			$('#translHeading').val( set.bearing );
			$('#translateDistance').val( set.distance );
			$('#simplificationKink').val( set.kink );
			$("#steps").val( set.steps );
			$('#startSt').val( set.start );
			$("#stopSt").val( set.stop );
			$('#animate').prop('checked', set.animation);
		}
		return {
			latPol : $('#polLatitude').val() * 1,
			lonPol : $('#polLongitude').val() * 1,
			azimuth : $('#azimuth').val() * 1,
			bearing : $('#translHeading').val() * 1,
			distance : $('#translateDistance').val() * 1,
			kink : $('#simplificationKink').val() * 1,
			steps : $("#steps").val() * 1,
			start : $('#startSt').val() * 1,
			stop : $("#stopSt").val() * 1,
			animation : !!$('#animate:checked').length
		}
	};

	/**
	 * Description
	 * @method setCoordinates
	 * @param {Object} n: can be Point || Polygon || Polyline
	 * @param {arrayLat: Number, arrayLon: Number} coordintesObj
	 */
	function setCoordinates ( n, coordintesObj ) {
		var type = n.type;
		if ( !type || !coordintesObj || !coordintesObj.arrayLat || !coordintesObj.arrayLon) {
			return;
			//throw new Error("Undefined type of n or invalid coordinateObj.");
		}
		var c = [];
		for ( var i = 0; i < coordintesObj.arrayLat.length; i++ ) {
			c.push( new _g.LatLng( coordintesObj.arrayLat[i], coordintesObj.arrayLon[i] ) );
		}
		if ( type == 'Marker' ) {
			n.setPosition( c[0] );
		}
		if ( type == 'Polyline' ) {
			n.setPath( c );
		}
		if ( type == 'Polygon' ) {
			n.setPaths( c );
		}
	};

	/**
	 * Duplicates Google Maps shape
	 * @method duplicateShape
	 * @param {Object} shape Point || Polygon || Polyline
	 * @return shape
	 */
	function duplicateShape( shape ) {
		var type = shape.type;
		if ( !type ) {
			return;
		}
		var attr = ['geodesic', 'strokeColor', 'strokeOpacity', 'strokeWeight', 'fillColor', 'fillOpacity', 'icon', 'name', 'type'];
		var options = {
			map : _map,
			id : uid(),
			parent : shape.id
		}
		shape.children.push( options.id );
		attr.forEach( function( attr ){
			if ( shape[attr] ) {
				options[attr] = shape[attr];
			}
		});
		return new _g[type](options);
	};

	/**
	 * Updates position of Euler pole marker based on user action
	 * @method updatePol
	 */
	function updatePol() {
		_eulerPoleMarker.setPosition(
			new _g.LatLng(
				$('#polLatitude').val() * 1,
				$('#polLongitude').val() * 1
			)
		);
	};

	/**
	 * Returns a Array of shape coordinates
	 * @method getLatLngArray
	 * @param {Object} n: Shape can be a Point || Polygon || Polyline
	 * @return Array[LatLng]
	 */
	function getLatLngArray ( n ) {
		var type = n.type;

		switch( type ){
			case 'Marker':
				return [ n.getPosition() ];
			break;

			case 'Polyline':
				return n.getPath().getArray();
			break;

			case 'Polygon':
				//BE CARFULE HERE, IT COULD HAVE MANY PATHS
				return n.getPath().getArray();
			break;

			default:
				return [];
		};
	};

	/**
	 * Updates position of translate marker based upon user input
	 * @method updateTranslationHelpers
	 */
	function updateTranslationHelpers() {
		if ( _selected[0] ) {
			_endTranslateMarker.setVisible( true );
			_translationLine.setVisible( true );
			var a = getLatLngArray( _selected[0] );
			if ( a ) {
				_startTranslateMarker.setPosition( a[0] );
				var s = _startTranslateMarker.getPosition();
				var h = $('#translHeading').val() * 1;
				var d = $('#translateDistance').val() * 1;
				var e = LatLonV.set( s ).destinationPoint(h, d)
				e = new _g.LatLng(e.lat, e.lon);
				_endTranslateMarker.setPosition( e );
				_translationLine.setPath( [s, e] );
			}
			return;
		}
		_endTranslateMarker.setVisible( false );
		_translationLine.setVisible( false );
	};


	/**
	 * Hide or delete shape
	 * @method shapeOptions
	 * @param {String} operation : can be hide or delete
	 */
	function shapeOptions( operation ) {
		if ( operation == 'hide' ) {
			_selected.forEach( function ( n ) {
				$('#' + n.id ).toggleClass('hidden-shape');

				n.setVisible( !n.getVisible() );
				n.children.forEach( function ( c ) {
					_obj[c].setVisible( !_obj[c].getVisible() );
				});
			})
		}
		if ( operation == 'delete' ) {
			_selected.forEach( function(n){
				$('#' + n.id ).remove();
				n.setMap( null );
				n.children.forEach( function ( c ) {
					_obj[c].setMap( null );
					delete _obj[c];
				});
				delete _obj[n.id];
			});
			_selected = [];
			if ( objLenght( _obj ) == 0 ) {
				$('#kml-items-helper').show();
			}
			updateFunctionalityUponSelect();
			updateTranslationHelpers();
		}
	};

	/**
	 * Executed on document load
	 * @method main
	 * @return
	 */
	function main() {
		//UI SETUP AND INIT
		$('.colapsable_hader').on('click', function ( e ) {
			$(this).parent().find('.colapsable_body').slideToggle();
			e.stopPropagation();
			return false;
		});

		$('.glyphicon-remove').on('click', function ( e ) {
			$(this).parent().parent().parent().toggle( "slide" );
			var el = $(this).attr('el');
			$('#heade-menu-view').find('li:eq(' + el + ')').toggleClass('disabled');
			e.stopPropagation();
			return false;
		});

		var dragTimer;
		$(document).on('dragover', function(e) {
			$("#upload").fadeIn();
			//$("#upload").css('height',$('#map3d').height() - 2);
			window.clearTimeout(dragTimer);
		})

		$(document).on('dragleave', function(e) {
			dragTimer = window.setTimeout(function() {
				$("#upload").fadeOut();
			}, 50);
		});

		$(document).on('drop', function(e) {
			dragTimer = window.setTimeout(function() {
				$("#upload").fadeOut();
			}, 50);
		});

		$( "#kmlItems" ).selectable({
			stop: function() {
				_selected = [];
				$( ".ui-selected", this ).each( function() {
					_selected.push( _obj[ $( this ).attr('id') ] );
				});
				updateFunctionalityUponSelect();
				updateTranslationHelpers();
				_map.panTo( _startTranslateMarker.getPosition() );
			}
		});

		$('#navbar-toggle-menu').on('click', function(){
			$(this).toggleClass('active');
			$('#side-menu').toggle( "slide" );
		});

		$("#heade-menu-view").find("li").on('click', function () {
			if ( !$(this).hasClass('disabled') ) {
				$('.colapsable_main:eq(' + $(this).attr('el') +')').toggle( "slide" );
				$(this).toggleClass('disabled');
			}
		});

		$('#toogle-grid-visibility').on('click', function ( ) {
			var on = $( this ).attr('grid-on');
			if ( on == 'true') {
				_grid.hide();
				$( this ).attr('grid-on', 'false');
			} else {
				_grid.show();
				$( this ).attr('grid-on', 'true');
			}
		});

		$('#fileinput').on('change', readInFile);

		$( '.glyphicon-minus' ).click();
		$( '.glyphicon-minus:first' ).click();

		var zero = new _g.LatLng(0, 0);
		var myOptions = {
			zoom: 3,
			center: zero,
			panControl: true,
				panControlOptions: {
			position: google.maps.ControlPosition.RIGHT_TOP
			},
			zoomControl: true,
			zoomControlOptions: {
				style: google.maps.ZoomControlStyle.LARGE,
				position: google.maps.ControlPosition.RIGHT_TOP
			},
			scaleControl: true,  // fixed to BOTTOM_RIGHT
			streetViewControl: false,
			mapTypeId: google.maps.MapTypeId.SATELLITE
		};
		_map = new _g.Map($("#map3d")[0], myOptions);
		_grid = new Graticule( _map, false );


		_eulerPoleMarker = new _g.Marker({
			map: _map,
			draggable: true,
			position : new _g.LatLng(0,0),
			icon: "images/oPole1.png",
			title  :"Drag the Euler pole!",
		});

		_endTranslateMarker = new _g.Marker({
			map: _map,
			draggable: true,
			position : new _g.LatLng(0,0),
			icon: "images/target1.png",
			title  :"Drag the end of translation to adjust heading and distance!",
		});

		_startTranslateMarker = new _g.Marker({
			position : new _g.LatLng(0,0),
		});

		_translationLine = new _g.Polyline({
			map : _map,
			path: [_startTranslateMarker.getPosition(), _endTranslateMarker.getPosition()],
			geodesic: true,
			strokeColor: '#00FF00',
			strokeOpacity: 1.0,
			strokeWeight: 2,
		});

		_g.event.addListener( _eulerPoleMarker, 'drag', function(e){
			$('#polLatitude').val(e.latLng.lat());
			$('#polLongitude').val(e.latLng.lng());
		});

		_g.event.addListener( _endTranslateMarker, 'drag', function(e){
			var s = _startTranslateMarker.getPosition();
			var e = _endTranslateMarker.getPosition();
			_translationLine.setPath( [s, e] );
			$('#translHeading').val( LatLonV.set(s).bearingTo( LatLonV.set(e) ) );
			$('#translateDistance').val( LatLonV.set(s).distanceTo( LatLonV.set(e) ) );
		});

		updateFunctionalityUponSelect();
		updateTranslationHelpers();
	};

		return {
			main : main,
			findEuler : findEuler,
			undo : undo,
			download : download,
			shapeOptions : shapeOptions,
			doSomething : doSomething,
			batch : batch,
			updateTranslationHelpers : updateTranslationHelpers,
			updatePol : updatePol
		}
})( $, google.maps, document, window, MARGEE );