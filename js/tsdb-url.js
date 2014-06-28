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

 	// Custom splitter since TSDB parameters can have embedded '=' in them.
 	OpenTSDBURL._splitByFirst = function(value, delim) {
 		if(value==null || value=='') return [];
 		var idx = value.indexOf(delim);
 		if(idx==-1) return [];
 		return [
 			value.substring(0, idx),
 			value.substring(idx + delim.length)
 		];
 	}

 	OpenTSDBURL._getInt = function(value) {
 		if(typeof(value) != "string") return null;
 		try {
 			return parseInt(value.trim());
 		} catch (e) { return null; }
 	}

 	// parses a metric segment such as "avg:1m-avg:rate{counter,10,20}:sys.cpu{cpu=*,type=combined,host=PP-WK-NWHI-01}"
 	OpenTSDBURL.prototype._parseMetric = function(m) {
 		console.group("Parsing metric definition [%s]", m);
 		try {
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
	 			throw "No tag starter found in metric definition [" + m + "]";
	 		}
	 		var prefixes = m.substring(0, idx).split(":");	 	
	 		console.debug("Prefixes: (idx:%s, [%s]) [%s]", idx, m.substring(0, idx), JSON.stringify(prefixes));	
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
	 				metric.downsample=prefixes[1];
	 				metric.aggregator=prefixes[0];
	 				break;
	 			case 3:     /// can be avg:rate:sys.cpu{cpu=*,type=combined,host=PP-WK-NWHI-01}    OR    avg:1m-avg:sys.cpu{cpu=*,type=combined,host=PP-WK-NWHI-01}
	 				metric.aggregator=prefixes[0];
	 				metric.name=prefixes[2];
	 				if(prefixes[1].indexOf("rate")!=-1) {
	 					metric.rate=prefixes[1];
	 				} else {
	 					metric.downsample=prefixes[1];
	 				}
	 				break;
	 			case 2:
	 				metric.name=prefixes[1];
	 				metric.aggregator=prefixes[0];
	 		}	
	 		if(metric.rate && rateCounterIdx != -1) {
	 			// rate can be:
	 				// rate
	 				// rate{opts}
	 					// counter
	 					// counter, max
	 					// counter ,, reset
	 					// counter, max, reset
	 			var rate = {};
	 			var rateOptions = /\{(.*?)\}/g.exec(metric.rate)[1].split(',');
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
	 			metric.rate = rate;
	 		}
	 		console.group("Processing Tags from [%s]", m.substring(idx));
	 		var tagDefs = /\{(.*?)\}/g.exec(m.substring(idx))[1].split(',');
	 		for(var x = 0, y = tagDefs.length; x < y; x++) {
	 			console.info("TAG PAIR: [%s]", tagDefs[x]);
	 			if(tagDefs[x].indexOf("=")) {
	 				var tagPair = tagDefs[x].split("=");
	 				if(tagPair.length==2) {
	 					tagPair[0] = tagPair[0].trim();
	 					tagPair[1] = tagPair[1].trim();
	 					if(tagPair[0]!='' && tagPair[1]!='') {
	 						metric.tags[tagPair[0]] = tagPair[1];
 						}
	 				}
	 			}
	 		}
	 		console.groupEnd();
	 		this.data.metrics.push(metric);




	 	} finally {
	 		console.groupEnd();
	 	}

 	}



 	var url = new URL(OpenTSDBURL._isEncoded(urlstring) ? urlstring : encodeURI(urlstring));
 	this.resource = {};
 	this.data = {
 		metrics : []
 	};
 	this.ui = {};
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
 						this._parseMetric(pair[1].replace('"', ''));
 						break;
 				}
 			}
 		}
 	}

}

 /*
	tsdb-url.js
	A JS class to parse an OpenTSDB metric/UI URL into a strucured JavaScript Object
	Whitehead, 2014
 */



/*

Cleaned Query: start=5m-ago&ignore=12295&m=avg:sys.cpu{cpu=*,type=combined,host=PP-WK-NWHI-01}&o=&yrange=[0:]&key=out right top box&wxh=1200x300&png



URL {hash: "", search: "?start=5m-ago&ignore=275&m=avg:sys.cpu%257Bcpu=*,t…ange=%255B0:%255D&wxh=900x300&smooth=csplines&png", pathname: "/q", port: "8080", hostname: "localhost"…}
hash: ""
host: "localhost:8080"
hostname: "localhost"
href: "http://localhost:8080/q?start=5m-ago&ignore=275&m=avg:sys.cpu%257Bcpu=*,type=combined,host=tpmint%257D&o=&m=sum:1m-avg:rate:sys.fs.bytes%257Bdir=*,type=ext4,host=tpmint%257D&o=axis%2520x1y2&ylabel=CPU%2520Percent%2520Usage&y2label=File%2520System%2520Byte%2520Rate&yrange=%255B0:100%255D&y2range=%255B0:%255D&wxh=900x300&smooth=csplines&png"
origin: "http://localhost:8080"
password: ""
pathname: "/q"
port: "8080"
protocol: "http:"
search: "?start=5m-ago&ignore=275&m=avg:sys.cpu%257Bcpu=*,type=combined,host=tpmint%257D&o=&m=sum:1m-avg:rate:sys.fs.bytes%257Bdir=*,type=ext4,host=tpmint%257D&o=axis%2520x1y2&ylabel=CPU%2520Percent%2520Usage&y2label=File%2520System%2520Byte%2520Rate&yrange=%255B0:100%255D&y2range=%255B0:%255D&wxh=900x300&smooth=csplines&png"
username: ""

*/


/*
http://localhost:8080/q?
start=5m-ago&
ignore=1&

	m=avg:sys.cpu{cpu=*,type=combined,host=tpmint}&
	o=&

	m=sum:1m-avg:rate:sys.fs.bytes{dir=*,type=ext4,host=tpmint}&
	o=axis x1y2&
	ylabel=CPU Percent Usage&
	y2label=File System Byte Rate&

yrange=[0:100]&
y2range=[0:]&
wxh=900x300&
smooth=csplines&
png
*/
