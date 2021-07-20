import { Handler } from "aws-lambda";

export const handler: Handler = (event, context, callback) => {
  console.log("Event ==> ", JSON.stringify(event, null, 2));
  callback(null, event);
};
