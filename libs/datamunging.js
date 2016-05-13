var _ = require("underscore");

var input1 = { 
	due_date: '2016-02-01T00:00:00Z',
	from_document: '',
	allow_online_payment: 'false',
	paid: 'true',
	locked: 'false',
	customer_id: '2446859',
	modified: '2016-02-02T15:09:06.983',
	created: '2016-02-01T21:09:37.873',
	date: '2016-02-01T00:00:00Z',
	inclusive: 'false',
	discount_percentage: '0',
	tax_reference: '',
	discount: '0',
	amount_due: '0',
	printed: 'false',
	editable: 'true',
	has_attachments: 'false',
	has_notes: 'false',
	has_anticipated_date: 'false',
	'lines[0][SelectionId]': '6824935',
	'lines[0][TaxTypeId]': '965302',
	'lines[0][ID]': '74465675',
	'lines[0][LineType]': '0',
	'lines[0][Quantity]': '1',
	'lines[0][Unit]': '',
	'lines[0][TaxPercentage]': '0.14',
	'lines[0][DiscountPercentage]': '0',
	'lines[0][Discount]': '0',
	'lines[1][ID]': '74465676',
	'lines[1][LineType]': '0',
	'lines[1][Quantity]': '4',
	'lines[1][Unit]': '',
	'lines[1][TaxPercentage]': '0.14',
	'lines[1][DiscountPercentage]': '0',
	'lines[1][Discount]': '0',
	'lines[1][Comments]': '',
	location: '547d506b184d110c0601314c',
	id: '93490358',
}

var test1 = { due_date: '2016-02-01T00:00:00Z',
  from_document: '',
  allow_online_payment: 'false',
  paid: 'true',
  locked: 'false',
  customer_id: '2446859',
  modified: '2016-02-02T15:09:06.983',
  created: '2016-02-01T21:09:37.873',
  date: '2016-02-01T00:00:00Z',
  inclusive: 'false',
  discount_percentage: '0',
  tax_reference: '',
  discount: '0',
  amount_due: '0',
  printed: 'false',
  editable: 'true',
  has_attachments: 'false',
  has_notes: 'false',
  has_anticipated_date: 'false',
  lines:
   [ { SelectionId: '6824935',
       TaxTypeId: '965302',
       ID: '74465675',
       LineType: '0',
       Quantity: '1',
       Unit: '',
       TaxPercentage: '0.14',
       DiscountPercentage: '0',
       Discount: '0' },
     { ID: '74465676',
       LineType: '0',
       Quantity: '4',
       Unit: '',
       TaxPercentage: '0.14',
       DiscountPercentage: '0',
       Discount: '0',
       Comments: '' } ],
  location: '547d506b184d110c0601314c',
  id: '93490358' }

input2 = {
	'test[0][Yo]': "0Yo",
	'test[0][No]': '0No',
	'test[1][Yo]': "1Yo",
	'test[1][No]': '1No',
	'test[3][No][Yo][0][Lo]': '2NoYo0Lo',
	normalProperty: 123
}

test2 = {
	test: [
		{
			Yo: "0Yo",
			No: "0No"
		},
		{
			Yo: "1Yo",
			No: "1No"
		},
		{
			No: {
				Yo: [
					{ Lo: "2NoYo0Lo" }
				]
			}
		}
	],
	normalProperty: 123
}

input3 = {
	'test[0][Yo]': "0Yo",
	'test[0][No]': '0No',
	'test[1][Yo]': "1Yo",
	'test[1][No]': '1No',
	normalProperty: 123
}

test3 = {
	test: [
		{
			Yo: "0Yo",
			No: "0No"
		},
		{
			Yo: "1Yo",
			No: "1No"
		}
	],
	normalProperty: 123
}

input4 = {
	'test[Blah][Yack]': 'BlahYack',
	'test[Blah][Blah]': 'BlahBlah'
}

test4 = {
	test: {
		Blah: {
			Yack: 'BlahYack',
			Blah: 'BlahBlah'
		}
	}
}

var arrayMatch = /\[\d+\]/;
var objMatch = /\[[a-zA-Z][a-zA-Z\d]*\]/;
var allMatch = /^[a-zA-Z\d_\-]+|\[[a-zA-Z\d_\-][a-zA-Z_\-\d]*\]|\[\d+\]/g;

/*  Copyright (C) 2012-2014  Kurt Milam - http://xioup.com | Source: https://gist.github.com/1868955
 *   
 *  Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *  The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
**/

// Based conceptually on the _.extend() function in underscore.js ( see http://documentcloud.github.com/underscore/#extend for more details )

function deepExtend(obj) {
  var parentRE = /#{\s*?_\s*?}/,
  slice = Array.prototype.slice;

  _.each(slice.call(arguments, 1), function(source) {
    for (var prop in source) {
      if (_.isUndefined(obj[prop]) || _.isFunction(obj[prop]) || _.isNull(source[prop]) || _.isDate(source[prop])) {
        obj[prop] = source[prop];
      }
      else if (_.isString(source[prop]) && parentRE.test(source[prop])) {
        if (_.isString(obj[prop])) {
          obj[prop] = source[prop].replace(parentRE, obj[prop]);
        }
      }
      else if (_.isArray(obj[prop]) || _.isArray(source[prop])){
        if (!_.isArray(obj[prop]) || !_.isArray(source[prop])){
          throw new Error('Trying to combine an array with a non-array (' + prop + ')');
        } else {
          obj[prop] = _.reject(_.deepExtend(_.clone(obj[prop]), source[prop]), function (item) { return _.isNull(item);});
        }
      }
      else if (_.isObject(obj[prop]) || _.isObject(source[prop])){
        if (!_.isObject(obj[prop]) || !_.isObject(source[prop])){
          throw new Error('Trying to combine an object with a non-object (' + prop + ')');
        } else {
          obj[prop] = _.deepExtend(_.clone(obj[prop]), source[prop]);
        }
      } else {
        obj[prop] = source[prop];
      }
    }
  });
  return obj;
};

_.mixin({ 'deepExtend': deepExtend });

/**
 * Dependency: underscore.js ( http://documentcloud.github.com/underscore/ )
 *
 * Mix it in with underscore.js:
 * _.mixin({deepExtend: deepExtend});
 * 
 * Call it like this:
 * var myObj = _.deepExtend(grandparent, child, grandchild, greatgrandchild)
 *
 * Notes:
 * Keep it DRY.
 * This function is especially useful if you're working with JSON config documents. It allows you to create a default
 * config document with the most common settings, then override those settings for specific cases. It accepts any
 * number of objects as arguments, giving you fine-grained control over your config document hierarchy.
 *
 * Special Features and Considerations:
 * - parentRE allows you to concatenate strings. example:
 *   var obj = _.deepExtend({url: "www.example.com"}, {url: "http://#{_}/path/to/file.html"});
 *   console.log(obj.url);
 *   output: "http://www.example.com/path/to/file.html"
 *
 * - parentRE also acts as a placeholder, which can be useful when you need to change one value in an array, while
 *   leaving the others untouched. example:
 *   var arr = _.deepExtend([100,    {id: 1234}, true,  "foo",  [250, 500]],
 *                          ["#{_}", "#{_}",     false, "#{_}", "#{_}"]);
 *   console.log(arr);
 *   output: [100, {id: 1234}, false, "foo", [250, 500]]
 *
 * - The previous example can also be written like this:
 *   var arr = _.deepExtend([100,    {id:1234},   true,  "foo",  [250, 500]],
 *                          ["#{_}", {},          false, "#{_}", []]);
 *   console.log(arr);
 *   output: [100, {id: 1234}, false, "foo", [250, 500]]
 *
 * - And also like this:
 *   var arr = _.deepExtend([100,    {id:1234},   true,  "foo",  [250, 500]],
 *                          ["#{_}", {},          false]);
 *   console.log(arr);
 *   output: [100, {id: 1234}, false, "foo", [250, 500]]
 *
 * - Array order is important. example:
 *   var arr = _.deepExtend([1, 2, 3, 4], [1, 4, 3, 2]);
 *   console.log(arr);
 *   output: [1, 4, 3, 2]
 *
 * - You can remove an array element set in a parent object by setting the same index value to null in a child object.
 *   example:
 *   var obj = _.deepExtend({arr: [1, 2, 3, 4]}, {arr: ["#{_}", null]});
 *   console.log(obj.arr);
 *   output: [1, 3, 4]
 *
 **/

function isNumeric(n) {
	return !isNaN(parseFloat(n)) && isFinite(n);
}

function isArray(a) {
	return Array.isArray(a);
}

var assignPropVal = function(parts, result, val) {
	var part = parts.shift().replace(/\[|\]/g, "");
	if (parts.length) {
		if (isNumeric(parts[0].replace(/\[|\]/g, ""))) {
			result[part] = [];
		} else {
			result[part] = {};
		}
		assignPropVal(parts, result[part], val);
	} else {
		result[part] = val;
	}
	return result;
}

var deserialize = function(input) {
	// console.log("INPUT", input);
	var result = {};
	var newobj = {};
	for (prop in input) {
		var parts = prop.match(allMatch);
		// console.log(prop, parts);
		var val = input[prop];
		if (parts) {
			var tmp = assignPropVal(parts, result, val);
			newobj = _.deepExtend(newobj, tmp);
		} else {
			// console.log("NOT ARRAY", parts);
			newobj[prop] = input[prop];
		}
		
	}
	// input = newobj;
	// console.log("Munge!", newobj);
	return newobj;
}

var runTest = function(name, input, test) {
	var result = deserialize(input);
	if (_.isEqual(result, test)) {
		console.log("PASSED " + name);
	} else {
		console.log("FAILED " + name);
		console.log(result);
	}
}

var test = function() {
	runTest("Test 1", input1, test1);
	runTest("Test 2", input2, test2);
	runTest("Test 3", input3, test3);
	runTest("Test 4", input4, test4);
}

module.exports = {
	deserialize: deserialize
}