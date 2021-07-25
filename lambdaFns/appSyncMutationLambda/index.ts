import * as gremlin from "gremlin";

import { Handler } from "./types";
import {
  createRemoteConnection,
  createGraphTraversalSource,
  idAlreadyExists,
  runQuery,
} from "./utils";

let conn: gremlin.driver.DriverRemoteConnection;
let g: gremlin.process.GraphTraversalSource;

export const handler: Handler = async event => {
  console.log("Event ==> ", JSON.stringify(event, null, 2));

  if (conn == null) {
    conn = createRemoteConnection();
    g = createGraphTraversalSource(conn);
  }

  if (await idAlreadyExists(g, event.detail)) {
    return { result: "Id already exists. No need to run the query." };
  }

  return await runQuery(g, event["detail-type"], event.detail);
};
