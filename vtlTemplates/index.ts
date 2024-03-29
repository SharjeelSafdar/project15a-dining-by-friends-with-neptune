export const EVENT_SOURCE = "p15a-appsync-api";

export const requestTemplate = (data: string, mutationType: string) => {
  return `
    {
      "version": "2018-05-29",
      "method": "POST",
      "resourcePath": "/",
      "params": {
        "headers": {
          "content-type": "application/x-amz-json-1.1",
          "x-amz-target":"AWSEvents.PutEvents"
        },
        "body": {
          "Entries": [
            {
              "DetailType": "${mutationType}",
              "Source": "${EVENT_SOURCE}",
              "EventBusName": "default",
              "Detail": "{${data}}"
            }
          ]
        }
      }
    }
  `;
};

export const responseTemplate = () => {
  return `
    #if($ctx.error)
      $util.error($ctx.error.message, $ctx.error.type)
    #end

    #if($ctx.result.statusCode == 200)
    {
      "result": "$util.parseJson($ctx.result.body)"
    }
    #else
      $utils.appendError($ctx.result.body, $ctx.result.statusCode)
    #end
  `;
};
