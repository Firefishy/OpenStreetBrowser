/* ajax.js
 * - JavaScript code that is used globally
 *
 * Copyright (c) 1998-2006 Stephan Plepelits <skunk@xover.mud.at>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.
 */
var last_params;

// ajax - calls a php_function with params
// parameter:
// funcname       the name of the php-function. the php-function has to 
//                be called "ajax_"+funcname
// param          an associative array of parameters
// postdata       (optional) data which should be posted to the server. it will
//                be passed to the ajax_[funcname] function as third parameter.
// callback       a function which will be called when the request ist 
//                finished. if empty the call will be syncronous and the
//                result will be returned
//
// return value/parameter to callback
// response       the status of the request
//  .responseText the response as plain text
//  .responseXML  the response as DOMDocument (if valid XML)
//  .return_value the return value of the function
function ajax(funcname, param, postdata, callback) {
  // private
  this.xmldata;
  // public
  var req=false;
  var sync;

  function get_return() {
    this.xmldata=req.responseXML;

    if(!this.xmldata)
      return req;

    var ret=this.xmldata.getElementsByTagName("return");
    if(ret.length) {
      var str="";
      var cur=ret[0].firstChild;
      while(cur) {
	if(cur.firstChild)
	  str+=cur.firstChild.nodeValue;
	cur=cur.nextSibling;
      }

      var ret=json_decode(str);
      req.return_value=ret;
    }
  }

  function req_change() {
    if(req.readyState==4) {
      if(req.status==0)
	return;

      get_return();

      if(callback)
        callback(req);
    }
  }

  // branch for native XMLHttpRequest object
  if(window.XMLHttpRequest) {
    try {
      req = new XMLHttpRequest();
    }
    catch(e) {
      req = false;
    }
    // branch for IE/Windows ActiveX version
  } else if(window.ActiveXObject) {
    try {
      req = new ActiveXObject("Msxml2.XMLHTTP");
    }
    catch(e) {
      try {
        req = new ActiveXObject("Microsoft.XMLHTTP");
      }
      catch(e) {
        req = false;
      }
    }
  }

  if(req) {
    var p=new Array();
    ajax_build_request(param, "param", p);
    p=p.join("&");

    if(typeof(postdata)=="function") {
      callback=postdata;
      postdata="";
    }
    else if(!postdata)
      postdata="";

    req.onreadystatechange = req_change;
    sync=callback!=null;
    req.open((postdata==""?"GET":"POST"),
             "ajax.php?func="+funcname+"&"+p, sync);
    last_params=p;

    if(postdata!="") {
      req.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
      req.setRequestHeader("Content-length", postdata.length);
      req.setRequestHeader("Connection", "close");
    }

    req.send(postdata);

    if(!sync) {
      get_return();
    }
  }

  return req;
}

function ajax_direct(url, param, _callback) {
  // private
  this.xmldata;
  // public
  var req=false;
  var callback;

  function req_change() {
    if(req.readyState==4) {
      if(req.status==0)
	return;

      this.xmldata=req.responseXML;

      if(callback)
        callback(req);
    }
  }

  // branch for native XMLHttpRequest object
  if(window.XMLHttpRequest) {
    try {
      req = new XMLHttpRequest();
    }
    catch(e) {
      req = false;
    }
    // branch for IE/Windows ActiveX version
  } else if(window.ActiveXObject) {
    try {
      req = new ActiveXObject("Msxml2.XMLHTTP");
    }
    catch(e) {
      try {
        req = new ActiveXObject("Microsoft.XMLHTTP");
      }
      catch(e) {
        req = false;
      }
    }
  }

  if(req) {
    var p=new Array();
    ajax_build_request(param, null, p);
    p=p.join("&");

    callback=_callback;
    req.onreadystatechange = req_change;
    req.open("GET", url+"?"+p, 1);
    last_params=p;
    req.send("");
  }

  return req;
}

function ajax_read_formated_text(xmldata, key) {
  ret="";

  obs=xmldata.getElementsByTagName(key);
  for(i=0; i<obs.length; i++) {
    ret+=obs[i].firstChild.nodeValue;
  }

  return ret;
}

function ajax_read_value(xmldata, key) {
  ob=xmldata.getElementsByTagName(key);
  if(!ob)
    return null;
  if(ob.length==0)
    return "";
  if(!ob[0].firstChild)
    return "";

  var text=ajax_read_formated_text(xmldata, key)
//console.log(text);
  var x=new Function("return "+text+";");
  //ob[0].firstChild.nodeValue+";");
  return x();
}

function ajax_build_request(param, prefix, ret) {
  if(typeof param=="object") {
    for(var k in param) {
      if(!prefix)
	ajax_build_request(param[k], k, ret);
      else
	ajax_build_request(param[k], prefix+"["+k+"]", ret);
    }
  }
  else if(typeof param=="number") {
    ret.push(prefix+"="+String(param));
  }
  else if(typeof param=="string") {
    ret.push(prefix+"="+urlencode(param));
  }
  else if(typeof param=="undefined") {
    ret.push(prefix+"="+0);
  }
  else if(typeof param=="function") {
    // ignore functions
  }
  else {
    alert("not supported var type: "+typeof param);
  }
}

function set_session_vars(vars, callback) {
  var params=new Array();

  for(var i in vars) {
    params.push("var["+i+"]="+vars[i]);
  }

  params=params.join("&");
  start_xmlreq(url_script({script: "toolbox.php", todo: "set_session_vars" })+"&"+params, 0, callback);
}

function get_content(ob) {
  if(ob.text)
    return ob.text;
  else
    return ob.textContent;
}

function ajax_post(url, getparam, postdata, _callback) {
  // private
  this.xmldata;
  // public
  var req=false;
  var callback;

  function req_change() {
    if(req.readyState==4) {
      if(req.status==0)
	return;

      this.xmldata=req.responseXML;

      if(callback)
        callback(req);
    }
  }

  // branch for native XMLHttpRequest object
  if(window.XMLHttpRequest) {
    try {
      req = new XMLHttpRequest();
    }
    catch(e) {
      req = false;
    }
    // branch for IE/Windows ActiveX version
  } else if(window.ActiveXObject) {
    try {
      req = new ActiveXObject("Msxml2.XMLHTTP");
    }
    catch(e) {
      try {
        req = new ActiveXObject("Microsoft.XMLHTTP");
      }
      catch(e) {
        req = false;
      }
    }
  }

  if(req) {
    var p=new Array();
    ajax_build_request(getparam, null, p);
    p=p.join("&");

    callback=_callback;
    req.onreadystatechange = req_change;
    req.open("POST", url+"?"+p, 1);

    req.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    req.setRequestHeader("Content-length", postdata.length);
    req.setRequestHeader("Connection", "close");

    req.send(postdata);
  }
  
  return req;
}

function ajax_json(funcname, param_get, param_post, callback) {
  if(this == window)
    return new ajax_json(funcname, param_get, param_post, callback);

  this.funcname = funcname;
  this.param_get = param_get;
  this.param_post = param_post;
  this.callback = callback;

  // branch for native XMLHttpRequest object
  if(window.XMLHttpRequest) {
    try {
      this.req = new XMLHttpRequest();
    }
    catch(e) {
      alert("XMLHttpRequest not supported!");
      return;
    }
    // branch for IE/Windows ActiveX version
  } else if(window.ActiveXObject) {
    try {
      this.req = new ActiveXObject("Msxml2.XMLHTTP");
    }
    catch(e) {
      try {
        this.req = new ActiveXObject("Microsoft.XMLHTTP");
      }
      catch(e) {
        alert("XMLHttpRequest not supported!");
        return;
      }
    }
  }

  var param_get_url = [];
  ajax_build_request(this.param_get, "param", param_get_url);
  param_get_url = param_get_url.join("&");

  if(typeof(this.param_post) == "function") {
    this.callback = this.param_post;
    this.param_post = null;
  }

  if(this.param_post)
    var param_post_enc = JSON.stringify(this.param_post);

  this.req.onreadystatechange = this.req_change.bind(this);
  var sync = (this.callback != null);
  this.req.open((param_post_enc == "" ? "GET" : "POST"),
           "ajax_json.php?func=" + this.funcname + "&" + param_get_url,
           sync);

  if(this.param_post !== null) {
    this.req.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    this.req.setRequestHeader("Content-length", param_post_enc.length);
    this.req.setRequestHeader("Connection", "close");
  }

  this.req.send(param_post_enc);
}

ajax_json.prototype.req_change = function() {
  if(this.req.readyState == 4) {
    if(this.req.status == 0)
      return;

    this.result = JSON.parse(this.req.responseText);

    if(this.callback)
      this.callback(this.result);
  }
}
