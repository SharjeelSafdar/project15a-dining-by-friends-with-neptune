import * as gremlin from "gremlin";

import { Details, MutationType } from "./types";

const __ = gremlin.process.statics;

export const getConnectionDetails = () => {
  const uri = `wss://${process.env.NEPTUNE_WRITER}/gremlin`;
  return { uri, headers: {} };
};

export const createRemoteConnection = () => {
  const { uri, headers } = getConnectionDetails();

  return new gremlin.driver.DriverRemoteConnection(uri, {
    mimeType: "application/vnd.gremlin-v2.0+json",
    pingEnabled: false,
    headers: headers,
  });
};

export const createGraphTraversalSource = (
  conn: gremlin.driver.DriverRemoteConnection
) => {
  return gremlin.process.traversal().withRemote(conn);
};

export const idAlreadyExists = async (
  g: gremlin.process.GraphTraversalSource,
  args: Details
) => {
  const result = await g.V().has("id", args.id).next();
  console.log("Id Exists ==> ", !!result.value);
  return !!result.value;
};

export const runQuery = async (
  g: gremlin.process.GraphTraversalSource,
  mutationType: string,
  args: Details
) => {
  switch (mutationType) {
    case MutationType.ADD_PERSON: {
      const result = await g
        .addV("person")
        .property("id", args.id)
        .property("username", args.newPerson.username)
        .property("email", args.newPerson.email)
        .property("firstName", args.newPerson.firstName)
        .property("lastName", args.newPerson.lastName)
        .addE("livesIn")
        .to(__.V().has("city", "id", args.newPerson.cityId))
        .next();

      console.log("Gremlin Query Result ==> ", JSON.stringify(result, null, 2));
      return {
        id: args.id,
        username: args.newPerson.username,
        email: args.newPerson.email,
        firstName: args.newPerson.firstName,
        lastName: args.newPerson.lastName,
        cityId: args.cityId,
        label: "person",
      };
    }
    case MutationType.ADD_CITY: {
      const result = await g
        .addV("city")
        .property("id", args.id)
        .property("name", args.name)
        .addE("within")
        .to(__.V().has("state", "id", args.stateId))
        .next();

      console.log("Gremlin Query Result ==> ", JSON.stringify(result, null, 2));
      return {
        id: args.id,
        name: args.name,
        stateId: args.stateId,
        label: "city",
      };
    }
    case MutationType.ADD_STATE: {
      const result = await g
        .addV("state")
        .property("id", args.id)
        .property("name", args.name)
        .next();

      console.log("Gremlin Query Result ==> ", JSON.stringify(result, null, 2));
      return {
        id: args.id,
        name: args.name,
        label: "state",
      };
    }
    default: {
      return;
    }
  }
};
