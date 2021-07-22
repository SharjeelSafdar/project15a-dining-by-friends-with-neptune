#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "@aws-cdk/core";
import { P15aGraphQlApiStack } from "../lib/project15a-dining-by-friends-with-neptune-stack";

const app = new cdk.App();
new P15aGraphQlApiStack(app, "Project15ADiningByFriendsWithNeptuneStack", {
  env: {
    account: "731540390537",
    region: "us-east-2",
  },
});
