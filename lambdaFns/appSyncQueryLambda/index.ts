import { AppSyncResolverHandler } from "aws-lambda";

type Arguments = any;
type Results = any;

export const handler: AppSyncResolverHandler<Arguments, Results> = async (
  event,
  context,
  callback
) => {
  console.log("Event ==> ", JSON.stringify(event, null, 2));
};
