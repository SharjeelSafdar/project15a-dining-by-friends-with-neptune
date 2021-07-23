import { PostConfirmationConfirmSignUpTriggerEvent, Handler } from "aws-lambda";
import * as gremlin from "gremlin";

const DriverRemoteConnection = gremlin.driver.DriverRemoteConnection;
const Graph = gremlin.structure.Graph;
const uri = process.env.NEPTUNE_WRITER as string;

export const handler: PostConfirmationHandler = async (
  event,
  context,
  callback
) => {
  console.log("Event ==> ", JSON.stringify(event, null, 2));

  let dc = new DriverRemoteConnection(`wss://${uri}/gremlin`, {});
  const graph = new Graph();
  const g = graph.traversal().withRemote(dc);

  let modifiedEvent: ModifiedEventType = event;
  try {
    const data = await g
      .addV("person")
      .property("username", event.userName)
      .property("email", event.request.userAttributes.email)
      .property("firstName", event.request.userAttributes.given_name)
      .property("lastName", event.request.userAttributes.family_name)
      .next();
    console.log("Person Added ==> ", JSON.stringify(data, null, 2));

    modifiedEvent.request.userAttributes.id = data.value.id;
    modifiedEvent.request.userAttributes.label = data.value.label;
  } catch (error) {
    console.log("Error ==> ", JSON.stringify(error, null, 2));
  } finally {
    dc.close();

    console.log("Return Obj ==> ", JSON.stringify(modifiedEvent, null, 2));
    callback(null, modifiedEvent);
  }
};

type ModifiedEventType = PostConfirmationConfirmSignUpTriggerEvent & {
  request: {
    userAttributes: {
      label?: string;
      id?: string;
    };
  };
};

type PostConfirmationHandler =
  Handler<PostConfirmationConfirmSignUpTriggerEvent>;
