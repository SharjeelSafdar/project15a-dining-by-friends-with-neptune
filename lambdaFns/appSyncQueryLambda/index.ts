import { AppSyncResolverHandler } from "aws-lambda";
import * as gremlin from "gremlin";

import { Arguments } from "./types";
import {
  createRemoteConnection,
  createGraphTraversalSource,
  runQuery,
} from "./utils";

let conn: gremlin.driver.DriverRemoteConnection;
let g: gremlin.process.GraphTraversalSource;

export const handler: AppSyncResolverHandler<Arguments, any> = async event => {
  console.log("Event ==> ", JSON.stringify(event, null, 2));

  if (conn == null) {
    conn = createRemoteConnection();
    g = createGraphTraversalSource(conn);
  }

  return await runQuery(g, event.info.fieldName, event.arguments);
};
