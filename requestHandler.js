// Thanks to SilverBeam (creator of SilverScripts) for allowing me to use the serializeObject and makeRequest functions from SilverScripts

function serializeObject(obj)
    {
        var pairs = [];
        for (var prop in obj)
        {
            if (!obj.hasOwnProperty(prop)) continue;
            pairs.push(prop + "=" + obj[prop]);
        }
        return pairs.join("&");
    }

function makeRequest(requestUrl, requestParams, callbackFunc, callbackParams = null)
{
    return new Promise((resolve) =>
    {
        var xhttp = new XMLHttpRequest();
        var payload = null;
        xhttp.onreadystatechange = function()
        {
            if (this.readyState == 4 && this.status == 200)
            {
                // Invoke the callback with the request response text and some parameters, if any were supplied
                // then resolve the Promise with the callback's reponse
                let callbackResponse = null;
                if (callbackFunc != null)
                {
                    callbackResponse = callbackFunc(this.responseText, callbackParams);
                }
                if (callbackResponse == null)
                {
                    callbackResponse = true;
                }
                resolve(callbackResponse);
            }
        };

        payload = serializeObject(requestParams);

        xhttp.open("POST", "https://fairview.deadfrontier.com/onlinezombiemmo/" + requestUrl + ".php", true);
        xhttp.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
        xhttp.setRequestHeader("x-requested-with", "ArysScriptsRequest");
        payload = "hash=" + unsafeWindow.hash(payload) + "&" + payload;
        xhttp.send(payload);
    });
}