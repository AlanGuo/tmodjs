/*! Template Runtime */

var runtime = function (require, exports, module) {

    function template (filename, content) {
        return (
            /string|function/.test(typeof content)
            ? compile : renderFile
        )(filename, content);
    };


    var cache = template.cache = {};
    var String = window.String;

    function toString (value, type) {

        if (typeof value !== 'string') {

            type = typeof value;
            if (type === 'number') {
                value += '';
            } else if (type === 'function') {
                value = toString(value.call(value));
            } else {
                value = '';
            }
        }

        return value;

    };


    var escapeMap = {
        "<": "&#60;",
        ">": "&#62;",
        '"': "&#34;",
        "'": "&#39;",
        "&": "&#38;"
    };


    function escapeFn (s) {
        return escapeMap[s];
    }


    function escapeHTML (content) {
        return toString(content)
        .replace(/&(?![\w#]+;)|[<>"']/g, escapeFn);
    };


    var isArray = Array.isArray || function(obj) {
        return ({}).toString.call(obj) === '[object Array]';
    };


    function each (data, callback) {
        if (isArray(data)) {
            for (var i = 0, len = data.length; i < len; i++) {
                callback.call(data, data[i], i, data);
            }
        } else {
            for (i in data) {
                callback.call(data, data[i], i);
            }
        }
    };


    function resolve (from, to) {
        var DOUBLE_DOT_RE = /(\/)[^/]+\1\.\.\1/;
        var dirname = ('./' + from).replace(/[^/]+$/, "");
        var filename = dirname + to;
        filename = filename.replace(/\/\.\//g, "/");
        while (filename.match(DOUBLE_DOT_RE)) {
            filename = filename.replace(DOUBLE_DOT_RE, "/");
        }
        return filename;
    };


    var utils = template.utils = {

        $helpers: {},

        $include: function (filename, data, from) {
            filename = resolve(from, filename);
            return renderFile(filename, data);
        },

        $string: toString,

        $escape: escapeHTML,

        $each: each
        
    };


    var helpers = template.helpers = utils.$helpers;


    function renderFile (filename, data) {
        var fn = template.get(filename) || showDebugInfo({
            filename: filename,
            name: 'Render Error',
            message: 'Template not found'
        });
        return data ? fn(data) : fn; 
    };


    function compile (filename, fn) {

        if (typeof fn === 'string') {
            var string = fn;
            fn = function () {
                return new String(string);
            };
        }

        var render = cache[filename] = function (data) {
            try {
                return new fn(data, filename) + '';
            } catch (e) {
                return showDebugInfo(e)();
            }
        };

        render.prototype = fn.prototype = utils;
        render.toString = function () {
            return fn + '';
        };

        return render;
    };


    function showDebugInfo (e) {

        var type = "{Template Error}";
        var message = e.stack || '';

        if (message) {
            // 利用报错堆栈信息
            message = message.split('\n').slice(0,2).join('\n');
        } else {
            // 调试版本，直接给出模板语句行
            for (var name in e) {
                message += "<" + name + ">\n" + e[name] + "\n\n";
            }  
        }

        return function () {
            if (typeof console === "object") {
                console.error(type + "\n\n" + message);
            }
            return type;
        };
    };


    template.get = function (filename) {
        return cache[filename.replace(/^\.\//, '')];
    };


    template.helper = function (name, helper) {
        helpers[name] = helper;
    };

    '<:namespace:>'
    '<:helpers:>'
    '<:templates:>'

    //兼容cmd-concat模式
    if(module){
        module.exports = template;
    }
}.toString();


var getNamespaceCode = function (type,namespace) {
    var code = '';

    var translateNS = "if('"+namespace+"'){"
    +   "var namespaceArray = '"+namespace+"'.split('.');"
    +   "var global = window;"
    +   "for(var i=0;i<namespaceArray.length;i++){"
    +       "var item = namespaceArray[i];"
    +       "global[item] = global[item] || {};"
    +       "global = global[item];"
    +   "}"
    +   "global.template = template;"
    +  "}"
    +  "else{"
    +    "this.template = template;"
    +  "}";

    switch (type) {

        // RequireJS / SeaJS 兼容模块格式
        case 'cmd':
        // RequireJS 模块格式
        case 'amd':

            code
            = "define(function(){"
            +      "return template;"
            + "});";
            break;

        // NodeJS 模块格式
        case 'commonjs':

            code = "module.exports = template;"
            break;

        // 在全局定义
        case 'global':
            
            code = translateNS;
            break;

        // 自适应格式
        default:

            code 
            = "if (typeof define === 'function') {"
            +    "define(function() {"
            +         "return template;"
            +     "});"
            + "} else if (typeof exports !== 'undefined') {"
            +     "module.exports = template;"
            + "} else {"
            +    translateNS
            + "}";

    }

    return code;
};


var VAR_RE = /['"]<\:(.*?)\:>['"]/g;

module.exports = function (data) {
    var namespace = data.namespace;
    data.namespace = getNamespaceCode(data.type,data.namespace);

    var code = runtime
    .replace(VAR_RE, function ($1, $2) {
        return data[$2] || '';
    });

    //兼容cmd合并文件模式
    if(data.type === 'cmd-concat'){
        code = 'define(\''+namespace+'\',' + code + ');';
    }
    else{
        code = '!' + code + '()';
    }
    
    return code;
};
