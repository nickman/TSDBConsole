
 /*
	tsdb-url.js
	A JS class to parse an OpenTSDB metric/UI URL into a strucured JavaScript Object
	Whitehead, 2014
 */


 function OpenTSDBURL(urlstring) {
 	// Performs a manual decode of the query path
 	// (that is, everything after the '?')
 	// since decodeURI seems to not decode many of the symbols
 	// used by OpenTSDB URLs
 	OpenTSDBURL._decodeQuery = function(url) {
 		if(url.search=="" || url.search=="?") return "";
 		return url.search
 			.replace(/%20/g, " ")
 			.replace(/%7B/g, "{")
 			.replace(/%7D/g, "}")
            .replace(/%5B/g, "[")
            .replace(/%5D/g, "]") 			
			.replace(/%2520/g, " ")
 			.replace(/%257B/g, "{")
 			.replace(/%257D/g, "}")
            .replace(/%255B/g, "[")
            .replace(/%255D/g, "]")
            .substring(1)	
 	}

 	OpenTSDBURL.durations = {
 		s : 'seconds',
 		m : 'minutes',
 		h : 'hours',
 		d : 'days',
 		w : 'weeks',
 		mn : 'months',
 		y : 'years'
 	}

 	OpenTSDBURL.aggregators = ["min","mimmin","max","mimmax","dev","sum","avg","zimsum"];
	OpenTSDBURL.keyBoxLocations = ['bottom', 'center', 'top', 'right', 'left'];
	OpenTSDBURL.outputType = ['png', 'json', 'csv'];




 	// Determines if the passed string appears to be encoded
 	// by scanning for a few common encoded symbols
 	OpenTSDBURL._isEncoded = function(urlstring) {
 		if(urlstring==null) return false;
 		var encoded =  
 			urlstring.indexOf('%20') != -1 ||
 			urlstring.indexOf('%7B') != -1 ||
 			urlstring.indexOf('%5B') != -1;
 		console.info("Encoded: [%s]", encoded);
 		return encoded;
 	}

 	OpenTSDBURL._splitAndTrim = function(value, delim, extract, remove) {
 		if(value==null) return [];
 		if(delim==null) return [value];
 		if(extract!=null) {
 			value = extract.exec(value);
 			if(value==null) return [];
 			console.debug("Extracted [%s]", JSON.stringify(value));
 			if(value.length<2) return [];
 			value = value[1];
 		}
 		console.debug("Splitting [%s]", value);
 		var splits = value.split(delim); 		
 		for(var x = 0, y = splits.length; x < y; x++) {
 			splits[x] = splits[x].trim();
 			if(remove && splits[x]=='') {
 				splits.splice(x, 1);
 				y--; x--;
 			}
 		}
 		console.debug("Split [%s]", JSON.stringify(splits));
 		return splits;
 	}

 	// Custom splitter since TSDB parameters can have embedded '=' in them.
 	OpenTSDBURL._splitByFirst = function(value, delim) {
 		if(value==null || value=='') return [];
 		var idx = value.indexOf(delim);
 		if(idx==-1) return [value.trim()];
 		return [
 			value.substring(0, idx).trim(),
 			value.substring(idx + delim.length).trim()
 		];
 	}

 	OpenTSDBURL._getInt = function(value) {
 		if(typeof(value) != "string") return null;
 		try {
 			return parseInt(value.trim());
 		} catch (e) { return null; }
 	}

 	OpenTSDBURL._parseRate = function(value) {
		// rate can be:
			// rate
			// rate{opts}
				// counter
				// counter, max
				// counter ,, reset
				// counter, max, reset
		var rate = {};
		var rateOptions = /\{(.*?)\}/g.exec(value)[1].split(',');
		var max = null, reset = null;
		switch(rateOptions.length) {
			case 1:
				rate.counter = 'counter';
				break;
			case 2:
				rate.counter = 'counter';
				max = OpenTSDBURL._getInt(rateOptions[1]);	 					
				if(max) rate.max = max;
				break;
			case 3:
				rate.counter = 'counter';
				max = OpenTSDBURL._getInt(rateOptions[1]);	 					
				if(max) rate.max = max;
				reset = OpenTSDBURL._getInt(rateOptions[2]);	 					
				if(reset) rate.reset = reset;
				break;	 				
		}
		return rate;
 	}

	OpenTSDBURL._parseTags = function(value) { 	
		var tags = {};
 		var tagDefs = /\{(.*?)\}/g.exec(value)[1].split(',');
 		for(var x = 0, y = tagDefs.length; x < y; x++) {
 			console.info("TAG PAIR: [%s]", tagDefs[x]);
 			if(tagDefs[x].indexOf("=")) {
 				var tagPair = tagDefs[x].split("=");
 				if(tagPair.length==2) {
 					tagPair[0] = tagPair[0].trim();
 					tagPair[1] = tagPair[1].trim();
 					if(tagPair[0]!='' && tagPair[1]!='') {
 						tags[tagPair[0]] = tagPair[1];
					}
 				}
 			}
 		}
 		return tags;
	}

	OpenTSDBURL._parseKeyOptions = function(value) {
		var key = {};
		if(value.trim()=="nokey") {
			key = {nokey: true};
			return key;
		} else {
			var keyOptions = OpenTSDBURL._splitAndTrim(value, " ", null, true);
			console.debug("Parsed Key Options: [%s]", JSON.stringify(keyOptions));			
			if(keyOptions.indexOf("nokey")!=-1) {
				key.nokey = true;	
				return key;
			}	 								
			if(keyOptions.indexOf("out")!=-1) {
				key.out = true;	
			}
			if(keyOptions.indexOf("box")!=-1) {
				key.box = true;	
			}
			if(keyOptions.indexOf("horiz")!=-1) {
				key.horiz = true;	
			}	
			var posOpts = [];
			for(var x = 0, y = keyOptions.length; x < y; x++) {
				var opt = keyOptions[x];
				if(OpenTSDBURL.keyBoxLocations.indexOf(opt)!=-1) {
					posOpts.push(opt);
				}
			}
			if(posOpts.length > 0) {
				key.position = posOpts;
			}
			return key;
		}
	}

	OpenTSDBURL._parseSize = function(value) {	
		var defaultSize = {w: 300, h: 300};
		if(value==null) return defaultSize;
		var idx = value.indexOf("x");
		if(idx==-1) return defaultSize;
		var wh = OpenTSDBURL._splitAndTrim(value, "x", null, false);
		try {
			return {w: parseInt(wh[0]), h: parseInt(wh[1])};
		} catch (e) {
			console.warn("Failed to parse size [%s], returning default size", value);
			return defaultSize;
		}

	}

	OpenTSDBURL._parseYAxisRange = function(value) {	
		var ranges = OpenTSDBURL._splitAndTrim(value, ":", /\[(.*?)\]/g, false);
		if(ranges==null || ranges.length==0) return {lower: 0, upper: ''};
		if(ranges.length==1) {
			var l = parseInt(ranges[0]);
			return {lower: (isNaN(l) ? '' : l), upper: ''};
		} 
		if(ranges.length==2) {
			var l = parseInt(ranges[0]);
			var n = parseInt(ranges[1]);
			return {lower: (isNaN(l) ? '' : l), upper: (isNaN(n) ? '' : n)};
		} 
		return {lower: 0, upper: ''};
	}

 	OpenTSDBURL._parseDownsample = function(value) {
 		// 1m-avg
 		var err = null;
 		try {
 			var downsample = {};
 			var vals = value.toLowerCase().split("-");
 			vals.every(function(val, idx, arr){ arr[idx] = val.trim(); });
 			if(OpenTSDBURL.aggregators.indexOf(vals[1])==-1) {
 				err = "Invalid aggregator: [" + vals[1] + "]";
 				throw err;
 			}
 			downsample.aggregator = vals[1];
 			var period = /(\d+)(\w+)/g.exec(vals[0]);
 			if(period.length!=3) {
 				err = "Invalid period: [" + vals[0] + "]";
 				throw err; 				
 			}
 			downsample.period = parseInt(period[1]);
 			downsample.unit = period[2];
 			return downsample;
 		} catch (e) {
 			if(err!=null) throw "Invalid downsample [" + value + "]: " + err;
 			throw "Invalid downsample [" + value + "]";
 		}
 	}

 	OpenTSDBURL._parsePrefixes = function(value, metric) {
 		var prefixes = value.split(":");
		console.debug("Prefixes: (raw:[%s]) [%s]", value, JSON.stringify(prefixes));	
 		var rateCounterIdx = value.indexOf(":rate{");
 		if(rateCounterIdx != -1) {
 			rateCounterIdx += 6;
 		}

 		if(prefixes.length < 2) {
 			throw "Failed to parse metric prefixes. Less than 2 prefixes in  metric definition [" + m + "]";
 		}
 		if(prefixes.length > 4) {
 			throw "Failed to parse metric prefixes. More than 4 prefixes in  metric definition [" + m + "]";
 		}
 		switch(prefixes.length) {
 			case 4: 			
 				metric.name=prefixes[3];
 				metric.rate=prefixes[2];
 				metric.downsample=OpenTSDBURL._parseDownsample(prefixes[1]);
 				metric.aggregator=prefixes[0];
 				break;
 			case 3:     /// can be avg:rate:sys.cpu{cpu=*,type=combined,host=PP-WK-NWHI-01}    OR    avg:1m-avg:sys.cpu{cpu=*,type=combined,host=PP-WK-NWHI-01}
 				metric.aggregator=prefixes[0];
 				metric.name=prefixes[2];
 				if(prefixes[1].indexOf("rate")!=-1) {
 					metric.rate=prefixes[1];
 				} else {
 					metric.downsample=OpenTSDBURL._parseDownsample(prefixes[1]);
 				}
 				break;
 			case 2:
 				metric.name=prefixes[1];
 				metric.aggregator=prefixes[0];
 		}	
 		if(metric.rate && rateCounterIdx != -1) {
 			metric.rate = OpenTSDBURL._parseRate(metric.rate);
 		}
 	}

 	// parses a metric segment such as "avg:1m-avg:rate{counter,10,20}:sys.cpu{cpu=*,type=combined,host=PP-WK-NWHI-01}"
 	OpenTSDBURL.prototype._parseMetric = function(m) {
 		var metric = {
 			tags : {}
 		};
 		var rateCounterIdx = m.indexOf(":rate{");
 		if(rateCounterIdx != -1) {
 			rateCounterIdx += 6;
 		}

 		
 		var idx = m.indexOf("{", rateCounterIdx==-1 ? 0 : rateCounterIdx+1);
 		console.info("Has Rate Counter: %s, rateIdx: %s, idx: %s", rateCounterIdx!=-1, rateCounterIdx, idx);
 		if(idx == -1) {
 			console.warn("No tag starter found in metric definition [" + m + "]");
 		}
 		
 		// parse prefixes here
 		OpenTSDBURL._parsePrefixes((idx != -1) ?  m.substring(0, idx) : m, metric);
 		
 		
 		if(idx != -1) {
 			console.group("Processing Tags from [%s]", m.substring(idx));
 			metric.tags = OpenTSDBURL._parseTags(m.substring(idx));
 		}
 		console.info("No tags to parse")
 		console.groupEnd();
 		this.data.metrics.push(metric);
 		return metric;
 	}



 	var url = new URL(OpenTSDBURL._isEncoded(urlstring) ? urlstring : encodeURI(urlstring));
 	this.resource = {};
 	this.data = {
 		metrics : []
 	};
 	this.ui = {
 		yrange: {
 			lower: 0,
 			upper: ''
 		},
 		y2range: {
 			lower: 0,
 			upper: ''
 		}

 	};
 	this.time = {};
 	// grab all the non query URL items
 	this.resource.host = url.host;
 	this.resource.hostname  = url.hostname;
 	this.resource.origin = url.origin;
 	this.resource.pathname = url.pathname;
 	this.resource.port = url.port;
 	this.resource.protocol = url.protocol;
 	// extract the full query path and decode
 	this.query = OpenTSDBURL._decodeQuery(url);
 	console.info("Query: [" + this.query + "]");
 	if(this.query!="") {
 		var splitQuery = this.query.split("&");
 		console.group("---- Parsing [%s] SplitQuery Entries", splitQuery.length);
 		try {
 			var currentMetric = null;
	 		for(var x = 0, y = splitQuery.length; x < y; x++) {
	 			var pair = OpenTSDBURL._splitByFirst(splitQuery[x], "=");
	 			console.info("Pair #%s (%s)", x, JSON.stringify(pair));
	 			if(pair!=null && pair.length > 0) {
	 				switch(pair[0]) {
	 					case "start" :
	 						if(pair.length>1) this.time.start = pair[1];
	 						break;
	 					case "m" :
	 						if(pair.length==1) throw "No metric 'm' value found for query path [" + this.query + "]";
	 						console.group("Parsing Metric Definition [%s]", pair[1]);
	 						try {
	 							currentMetric = this._parseMetric(pair[1].replace('"', ''));
	 						} finally { console.groupEnd(); }
	 						break;
	 					case "o" :  // specifies a non-default axis
	 						try {
	 							console.group("Parsing Metric Y-Axis: [%s]", pair[1]);
	 							var axisPair = pair[1].split(/\s+/);
	 							if(axisPair.length==2 && axisPair[0]=='axis') {
	 								currentMetric.axis = axisPair[1];
	 								console.info("Metric Axis: [%s]", axisPair[1]);
	 							}
	 						} finally { console.groupEnd(); }
	 						break;
	 					case "yrange" :
	 						try {
	 							console.group("Parsing UI Y-Axis 1 Range: [%s]", pair[1]);
	 							this.ui.yrange = OpenTSDBURL._parseYAxisRange(pair[1]);
	 						} finally { console.groupEnd(); }
	 						break; 
	 					case "y2range" :
	 						try {
	 							console.group("Parsing UI Y-Axis 2 Range: [%s]", pair[1]);
	 							this.ui.y2range = OpenTSDBURL._parseYAxisRange(pair[1]);
	 						} finally { console.groupEnd(); }
	 						break;
	 					case "ylabel" :
	 						try {
	 							console.group("Parsing Y-Axis 1 Label: [%s]", pair[1]);
	 							this.ui.ylabel = pair[1].trim();
	 						} finally { console.groupEnd(); }
	 						break; 
	 					case "y2label" :
	 						try {
	 							console.group("Parsing Y-Axis 2 Label: [%s]", pair[1]);
	 							this.ui.y2label = pair[1].trim();
	 						} finally { console.groupEnd(); }
	 						break;
	 					case "yformat" :
	 						try {
	 							console.group("Parsing Y-Axis 1 Format: [%s]", pair[1]);
	 							this.ui.yformat = pair[1].trim();
	 						} finally { console.groupEnd(); }
	 						break; 
	 					case "y2format" :
	 						try {
	 							console.group("Parsing Y-Axis 2 Formar: [%s]", pair[1]);
	 							this.ui.y2format = pair[1].trim();
	 						} finally { console.groupEnd(); }
	 						break;
	 					case "ylog" :
	 						try {
	 							console.group("Parsing Y-Axis 1 Log Scale");
	 							this.ui.ylog = true;
	 						} finally { console.groupEnd(); }
	 						break; 
	 					case "y2log" :
	 						try {
	 							console.group("Parsing Y-Axis 2 Log Scale");
	 							this.ui.y2log = true;
	 						} finally { console.groupEnd(); }
	 						break;
	 					case "key" :
	 						try {
	 							console.group("Parsing Chart Key Options: [%s]", pair[1]);
	 							this.ui.key = OpenTSDBURL._parseKeyOptions(pair[1]);

	 							// smooth=csplines

	 						} finally { console.groupEnd(); }
	 						break;
	 					case "smooth" :
	 						try {
	 							console.group("Parsing Chart Smoothing Options: [%s]", pair[1]);
	 							if(pair[1].length>0) {
	 								this.ui.smooth = pair[1];	
	 							}
	 						} finally { console.groupEnd(); }
	 						break;
	 					case "wxh":
	 						try {
	 							console.group("Parsing Chart Size Options: [%s]", pair[1]);
	 							this.ui.size = OpenTSDBURL._parseSize(pair[1]);
 							} finally { console.groupEnd(); }	 						
	 						break;
	 					case "png": case "json": case "csv": 
	 						this.ui.output = pair[0];
	 						break;


	 				}
	 			}
	 		}
	 	} finally {
	 		console.groupEnd();
	 	}
 	}

}

