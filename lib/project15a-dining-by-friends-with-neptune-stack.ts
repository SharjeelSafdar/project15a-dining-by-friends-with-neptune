import * as cdk from "@aws-cdk/core";
import * as cognito from "@aws-cdk/aws-cognito";
import * as ec2 from "@aws-cdk/aws-ec2";
import * as neptune from "@aws-cdk/aws-neptune";
import * as appsync from "@aws-cdk/aws-appsync";
import * as events from "@aws-cdk/aws-events";
import * as eventTargets from "@aws-cdk/aws-events-targets";
import * as lambda from "@aws-cdk/aws-lambda";

import {
  EVENT_SOURCE,
  requestTemplate,
  responseTemplate,
} from "../vtlTemplates/index";

export class P15aGraphQlApiStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    /* ******************************************************** */
    /* ******************* Cognito UserPool ******************* */
    /* ******************************************************** */
    const userPool = new cognito.UserPool(this, "P15aUserPool", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
        username: true,
      },
      signInCaseSensitive: true,
      passwordPolicy: {
        minLength: 8,
        requireDigits: true,
        requireLowercase: true,
        requireUppercase: true,
      },
      autoVerify: {
        email: true,
      },
      userVerification: {
        emailStyle: cognito.VerificationEmailStyle.LINK,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      standardAttributes: {
        email: { required: true, mutable: false },
        givenName: { required: true, mutable: true },
        familyName: { required: true, mutable: true },
      },
    });

    const userPoolClient = userPool.addClient("P15aUserPoolClient", {
      authFlows: {
        userPassword: true,
      },
    });

    new cdk.CfnOutput(this, "P15aUserPoolClientId", {
      value: userPoolClient.userPoolClientId,
    });

    const userPoolDomain = userPool.addDomain("P15aUserPoolDomain", {
      cognitoDomain: {
        domainPrefix: "dining-by-friends-p15a",
      },
    });

    new cdk.CfnOutput(this, "P15aUserPoolDomain", {
      value: userPoolDomain.domainName,
    });

    /* ********************************************************* */
    /* ************ Neptune DB Cluster and Instance ************ */
    /* ********************************************************* */
    const vpc = new ec2.Vpc(this, "P15aVpc", {
      maxAzs: 2,
      subnetConfiguration: [
        {
          name: "Ingress",
          subnetType: ec2.SubnetType.ISOLATED,
          cidrMask: 24,
        },
      ],
    });

    const securityGroup = new ec2.SecurityGroup(this, "P15aSecurityGroup", {
      vpc,
      securityGroupName: "P15aSecurityGroup",
      description: "Security group for Neptune DB",
      allowAllOutbound: true,
    });
    securityGroup.addIngressRule(
      securityGroup,
      ec2.Port.tcp(8182),
      "Rule for accessing NeptuneDB instance."
    );

    const cluster = new neptune.DatabaseCluster(this, "P15aNeptuneCluster", {
      dbClusterName: "P15a-Neptune-Cluster",
      vpc,
      vpcSubnets: vpc.selectSubnets({ subnetType: ec2.SubnetType.ISOLATED }),
      securityGroups: [securityGroup],
      instanceType: neptune.InstanceType.T3_MEDIUM,
      engineVersion: neptune.EngineVersion.V1_0_4_1,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      deletionProtection: false,
    });
    cluster.connections.allowDefaultPortFromAnyIpv4("Open to the world");

    /* ******************************************************** */
    /* *************** Create New Person Lambda *************** */
    /* ******************************************************** */
    const newPersonLambda = new lambda.Function(this, "P15aNewPersonLambda", {
      functionName: "p15a-new-person-lambda",
      runtime: lambda.Runtime.NODEJS_14_X,
      code: lambda.Code.fromAsset("lambdaFns/newPerson"),
      handler: "index.handler",
      memorySize: 1024,
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.ISOLATED,
      },
      securityGroups: [securityGroup],
      environment: {
        NEPTUNE_READER: cluster.clusterReadEndpoint.socketAddress,
        NEPTUNE_WRITER: cluster.clusterEndpoint.socketAddress,
      },
      timeout: cdk.Duration.seconds(10),
    });

    userPool.addTrigger(
      cognito.UserPoolOperation.POST_CONFIRMATION,
      newPersonLambda
    );

    /* ********************************************************* */
    /* ****************** AppSync GraphQL API ****************** */
    /* ********************************************************* */
    const gqlApi = new appsync.GraphqlApi(this, "P15aGraphQlApi", {
      name: "P15a-GraphQL-Api",
      schema: appsync.Schema.fromAsset("apiSchema/diningByFriends.gql"),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.IAM,
          apiKeyConfig: {
            expires: cdk.Expiration.after(cdk.Duration.days(365)),
          },
        },
      },
    });

    /* ********************************************************** */
    /* *************** GraphQL API Query Resolver *************** */
    /* ********************************************************** */
    const appSyncQueryLambda = new lambda.Function(
      this,
      "P15aAppSyncQueryLambda",
      {
        functionName: "p15a-appsync-query-lambda",
        runtime: lambda.Runtime.NODEJS_14_X,
        code: lambda.Code.fromAsset("lambdaFns/appSyncQueryLambda"),
        handler: "index.handler",
        memorySize: 1024,
        vpc,
        vpcSubnets: {
          subnetType: ec2.SubnetType.ISOLATED,
        },
        securityGroups: [securityGroup],
        environment: {
          NEPTUNE_READER: cluster.clusterReadEndpoint.socketAddress,
          NEPTUNE_WRITER: cluster.clusterEndpoint.socketAddress,
        },
        timeout: cdk.Duration.seconds(10),
      }
    );

    const queryLambdaDS = gqlApi.addLambdaDataSource(
      "P15aLambdaDS",
      appSyncQueryLambda
    );

    queryLambdaDS.createResolver({
      typeName: "Query",
      fieldName: "getPerson",
    });

    queryLambdaDS.createResolver({
      typeName: "Query",
      fieldName: QueryType.GET_ALL_STATES,
    });

    queryLambdaDS.createResolver({
      typeName: "Query",
      fieldName: QueryType.GET_ALL_CITIES,
    });

    queryLambdaDS.createResolver({
      typeName: "Query",
      fieldName: QueryType.GET_ALL_CUISINES,
    });

    queryLambdaDS.createResolver({
      typeName: "Query",
      fieldName: QueryType.GET_ALL_RESTAURANTS,
    });

    queryLambdaDS.createResolver({
      typeName: "Query",
      fieldName: QueryType.GET_ALL_PERSONS,
    });

    queryLambdaDS.createResolver({
      typeName: "Query",
      fieldName: QueryType.GET_ALL_REVIEWS,
    });

    queryLambdaDS.createResolver({
      typeName: "Query",
      fieldName: QueryType.GET_ALL_REVIEW_RATINGS,
    });

    /* ************************************************************** */
    /* *************** GraphQL API Mutation Resolvers *************** */
    /* ************************************************************** */
    const httpEventBridgeDS = gqlApi.addHttpDataSource(
      "P15aHttpEventBridgeDS",
      `https://events.${this.region}.amazonaws.com/`,
      {
        name: "p15aHttpEventBridgeDS",
        description: "Sending events to EventBridge on AppSync mutations",
        authorizationConfig: {
          signingRegion: this.region,
          signingServiceName: "events",
        },
      }
    );
    events.EventBus.grantAllPutEvents(httpEventBridgeDS);

    const addPersonArgs = `\\\"id\\\": \\\"$util.autoId()\\\", \\\"newPerson\\\": { \\\"username\\\": \\\"$ctx.args.newPerson.username\\\", \\\"email\\\": \\\"$ctx.args.newPerson.email\\\", \\\"firstName\\\": \\\"$ctx.args.newPerson.firstName\\\", \\\"lastName\\\": \\\"$ctx.args.newPerson.lastName\\\", \\\"cityId\\\": \\\"$ctx.args.newPerson.cityId\\\" }`;
    httpEventBridgeDS.createResolver({
      typeName: "Mutation",
      fieldName: MutationType.ADD_PERSON,
      requestMappingTemplate: appsync.MappingTemplate.fromString(
        requestTemplate(addPersonArgs, MutationType.ADD_PERSON)
      ),
      responseMappingTemplate: appsync.MappingTemplate.fromString(
        responseTemplate()
      ),
    });

    const addUpdateFirstNameArgs = `\\\"personId\\\": \\\"$ctx.args.personId\\\", \\\"firstName\\\": \\\"$ctx.args.firstName\\\"`;
    httpEventBridgeDS.createResolver({
      typeName: "Mutation",
      fieldName: MutationType.ADD_UPDATE_FIRST_NAME,
      requestMappingTemplate: appsync.MappingTemplate.fromString(
        requestTemplate(
          addUpdateFirstNameArgs,
          MutationType.ADD_UPDATE_FIRST_NAME
        )
      ),
      responseMappingTemplate: appsync.MappingTemplate.fromString(
        responseTemplate()
      ),
    });

    const addUpdateLastNameArgs = `\\\"personId\\\": \\\"$ctx.args.personId\\\", \\\"lastName\\\": \\\"$ctx.args.lastName\\\"`;
    httpEventBridgeDS.createResolver({
      typeName: "Mutation",
      fieldName: MutationType.ADD_UPDATE_LAST_NAME,
      requestMappingTemplate: appsync.MappingTemplate.fromString(
        requestTemplate(
          addUpdateLastNameArgs,
          MutationType.ADD_UPDATE_LAST_NAME
        )
      ),
      responseMappingTemplate: appsync.MappingTemplate.fromString(
        responseTemplate()
      ),
    });

    const deletePersonArgs = `\\\"personId\\\": \\\"$ctx.args.personId\\\"`;
    httpEventBridgeDS.createResolver({
      typeName: "Mutation",
      fieldName: MutationType.DELETE_PERSON,
      requestMappingTemplate: appsync.MappingTemplate.fromString(
        requestTemplate(deletePersonArgs, MutationType.DELETE_PERSON)
      ),
      responseMappingTemplate: appsync.MappingTemplate.fromString(
        responseTemplate()
      ),
    });

    const addStateArgs = `\\\"id\\\": \\\"$util.autoId()\\\", \\\"name\\\": \\\"$ctx.args.name\\\"`;
    httpEventBridgeDS.createResolver({
      typeName: "Mutation",
      fieldName: MutationType.ADD_STATE,
      requestMappingTemplate: appsync.MappingTemplate.fromString(
        requestTemplate(addStateArgs, MutationType.ADD_STATE)
      ),
      responseMappingTemplate: appsync.MappingTemplate.fromString(
        responseTemplate()
      ),
    });

    const updateStateNameArgs = `\\\"stateId\\\": \\\"$ctx.args.stateId\\\", \\\"newName\\\": \\\"$ctx.args.newName\\\"`;
    httpEventBridgeDS.createResolver({
      typeName: "Mutation",
      fieldName: MutationType.UPDATE_STATE_NAME,
      requestMappingTemplate: appsync.MappingTemplate.fromString(
        requestTemplate(updateStateNameArgs, MutationType.UPDATE_STATE_NAME)
      ),
      responseMappingTemplate: appsync.MappingTemplate.fromString(
        responseTemplate()
      ),
    });

    const deleteStateArgs = `\\\"stateId\\\": \\\"$ctx.args.stateId\\\"`;
    httpEventBridgeDS.createResolver({
      typeName: "Mutation",
      fieldName: MutationType.DELETE_STATE,
      requestMappingTemplate: appsync.MappingTemplate.fromString(
        requestTemplate(deleteStateArgs, MutationType.DELETE_STATE)
      ),
      responseMappingTemplate: appsync.MappingTemplate.fromString(
        responseTemplate()
      ),
    });

    const addCityArgs = `\\\"id\\\": \\\"$util.autoId()\\\", \\\"name\\\": \\\"$ctx.args.name\\\", \\\"stateId\\\": \\\"$ctx.args.stateId\\\"`;
    httpEventBridgeDS.createResolver({
      typeName: "Mutation",
      fieldName: MutationType.ADD_CITY,
      requestMappingTemplate: appsync.MappingTemplate.fromString(
        requestTemplate(addCityArgs, MutationType.ADD_CITY)
      ),
      responseMappingTemplate: appsync.MappingTemplate.fromString(
        responseTemplate()
      ),
    });

    const updateCityNameArgs = `\\\"cityId\\\": \\\"$ctx.args.cityId\\\", \\\"newName\\\": \\\"$ctx.args.newName\\\"`;
    httpEventBridgeDS.createResolver({
      typeName: "Mutation",
      fieldName: MutationType.UPDATE_CITY_NAME,
      requestMappingTemplate: appsync.MappingTemplate.fromString(
        requestTemplate(updateCityNameArgs, MutationType.UPDATE_CITY_NAME)
      ),
      responseMappingTemplate: appsync.MappingTemplate.fromString(
        responseTemplate()
      ),
    });

    const deleteCityArgs = `\\\"cityId\\\": \\\"$ctx.args.cityId\\\"`;
    httpEventBridgeDS.createResolver({
      typeName: "Mutation",
      fieldName: MutationType.DELETE_CITY,
      requestMappingTemplate: appsync.MappingTemplate.fromString(
        requestTemplate(deleteCityArgs, MutationType.DELETE_CITY)
      ),
      responseMappingTemplate: appsync.MappingTemplate.fromString(
        responseTemplate()
      ),
    });

    const addCuisineArgs = `\\\"id\\\": \\\"$util.autoId()\\\", \\\"name\\\": \\\"$ctx.args.name\\\"`;
    httpEventBridgeDS.createResolver({
      typeName: "Mutation",
      fieldName: MutationType.ADD_CUISINE,
      requestMappingTemplate: appsync.MappingTemplate.fromString(
        requestTemplate(addCuisineArgs, MutationType.ADD_CUISINE)
      ),
      responseMappingTemplate: appsync.MappingTemplate.fromString(
        responseTemplate()
      ),
    });

    const updateCuisineNameArgs = `\\\"cuisineId\\\": \\\"$ctx.args.cuisineId\\\", \\\"newName\\\": \\\"$ctx.args.newName\\\"`;
    httpEventBridgeDS.createResolver({
      typeName: "Mutation",
      fieldName: MutationType.UPDATE_CUISINE_NAME,
      requestMappingTemplate: appsync.MappingTemplate.fromString(
        requestTemplate(updateCuisineNameArgs, MutationType.UPDATE_CUISINE_NAME)
      ),
      responseMappingTemplate: appsync.MappingTemplate.fromString(
        responseTemplate()
      ),
    });

    const deleteCuisineArgs = `\\\"cuisineId\\\": \\\"$ctx.args.cuisineId\\\"`;
    httpEventBridgeDS.createResolver({
      typeName: "Mutation",
      fieldName: MutationType.DELETE_CUISINE,
      requestMappingTemplate: appsync.MappingTemplate.fromString(
        requestTemplate(deleteCuisineArgs, MutationType.DELETE_CUISINE)
      ),
      responseMappingTemplate: appsync.MappingTemplate.fromString(
        responseTemplate()
      ),
    });

    const addRestaurantArgs = `\\\"id\\\": \\\"$util.autoId()\\\", \\\"newRestaurant\\\": { \\\"name\\\": \\\"$ctx.args.newRestaurant.name\\\", \\\"address\\\": \\\"$ctx.args.newRestaurant.address\\\", \\\"cityId\\\": \\\"$ctx.args.newRestaurant.cityId\\\", \\\"cuisineId\\\": \\\"$ctx.args.newRestaurant.cuisineId\\\" }`;
    httpEventBridgeDS.createResolver({
      typeName: "Mutation",
      fieldName: MutationType.ADD_RESTAURANT,
      requestMappingTemplate: appsync.MappingTemplate.fromString(
        requestTemplate(addRestaurantArgs, MutationType.ADD_RESTAURANT)
      ),
      responseMappingTemplate: appsync.MappingTemplate.fromString(
        responseTemplate()
      ),
    });

    const updateRestaurantNameArgs = `\\\"restaurantId\\\": \\\"$ctx.args.restaurantId\\\", \\\"newName\\\": \\\"$ctx.args.newName\\\"`;
    httpEventBridgeDS.createResolver({
      typeName: "Mutation",
      fieldName: MutationType.UPDATE_RESTAURANT_NAME,
      requestMappingTemplate: appsync.MappingTemplate.fromString(
        requestTemplate(
          updateRestaurantNameArgs,
          MutationType.UPDATE_RESTAURANT_NAME
        )
      ),
      responseMappingTemplate: appsync.MappingTemplate.fromString(
        responseTemplate()
      ),
    });

    const updateRestaurantAddressArgs = `\\\"restaurantId\\\": \\\"$ctx.args.restaurantId\\\", \\\"newAddress\\\": \\\"$ctx.args.newAddress\\\"`;
    httpEventBridgeDS.createResolver({
      typeName: "Mutation",
      fieldName: MutationType.UPDATE_RESTAURANT_ADDRESS,
      requestMappingTemplate: appsync.MappingTemplate.fromString(
        requestTemplate(
          updateRestaurantAddressArgs,
          MutationType.UPDATE_RESTAURANT_ADDRESS
        )
      ),
      responseMappingTemplate: appsync.MappingTemplate.fromString(
        responseTemplate()
      ),
    });

    const deleteRestaurantArgs = `\\\"restaurantId\\\": \\\"$ctx.args.restaurantId\\\"`;
    httpEventBridgeDS.createResolver({
      typeName: "Mutation",
      fieldName: MutationType.DELETE_RESTAURANT,
      requestMappingTemplate: appsync.MappingTemplate.fromString(
        requestTemplate(deleteRestaurantArgs, MutationType.DELETE_RESTAURANT)
      ),
      responseMappingTemplate: appsync.MappingTemplate.fromString(
        responseTemplate()
      ),
    });

    const addReviewArgs = `\\\"id\\\": \\\"$util.autoId()\\\", \\\"createdAt\\\": $util.time.nowEpochSeconds(), \\\"newReview\\\": { \\\"rating\\\": $ctx.args.newReview.rating, \\\"body\\\": \\\"$ctx.args.newReview.body\\\", \\\"personId\\\": \\\"$ctx.args.newReview.personId\\\", \\\"restaurantId\\\": \\\"$ctx.args.newReview.restaurantId\\\" }`;
    httpEventBridgeDS.createResolver({
      typeName: "Mutation",
      fieldName: MutationType.ADD_REVIEW,
      requestMappingTemplate: appsync.MappingTemplate.fromString(
        requestTemplate(addReviewArgs, MutationType.ADD_REVIEW)
      ),
      responseMappingTemplate: appsync.MappingTemplate.fromString(
        responseTemplate()
      ),
    });

    const deleteReviewArgs = `\\\"reviewId\\\": \\\"$ctx.args.reviewId\\\"`;
    httpEventBridgeDS.createResolver({
      typeName: "Mutation",
      fieldName: MutationType.DELETE_REVIEW,
      requestMappingTemplate: appsync.MappingTemplate.fromString(
        requestTemplate(deleteReviewArgs, MutationType.DELETE_REVIEW)
      ),
      responseMappingTemplate: appsync.MappingTemplate.fromString(
        responseTemplate()
      ),
    });

    const addReviewRatingArgs = `\\\"id\\\": \\\"$util.autoId()\\\", \\\"reviewDate\\\": $util.time.nowEpochSeconds(), \\\"newReviewRating\\\": { \\\"thumbsUp\\\": $ctx.args.newReviewRating.thumbsUp, \\\"reviewId\\\": \\\"$ctx.args.newReviewRating.reviewId\\\", \\\"personId\\\": \\\"$ctx.args.newReviewRating.personId\\\" }`;
    httpEventBridgeDS.createResolver({
      typeName: "Mutation",
      fieldName: MutationType.ADD_REVIEW_RATING,
      requestMappingTemplate: appsync.MappingTemplate.fromString(
        requestTemplate(addReviewRatingArgs, MutationType.ADD_REVIEW_RATING)
      ),
      responseMappingTemplate: appsync.MappingTemplate.fromString(
        responseTemplate()
      ),
    });

    const deleteReviewRatingArgs = `\\\"reviewRatingId\\\": \\\"$ctx.args.reviewRatingId\\\"`;
    httpEventBridgeDS.createResolver({
      typeName: "Mutation",
      fieldName: MutationType.DELETE_REVIEW_RATING,
      requestMappingTemplate: appsync.MappingTemplate.fromString(
        requestTemplate(
          deleteReviewRatingArgs,
          MutationType.DELETE_REVIEW_RATING
        )
      ),
      responseMappingTemplate: appsync.MappingTemplate.fromString(
        responseTemplate()
      ),
    });

    const addFriendsEdgeArgs = `\\\"fromId\\\": \\\"$ctx.args.fromId\\\", \\\"toId\\\": \\\"$ctx.args.toId\\\", \\\"id\\\": \\\"$util.autoId()\\\"`;
    httpEventBridgeDS.createResolver({
      typeName: "Mutation",
      fieldName: MutationType.ADD_FRIENDS_EDGE,
      requestMappingTemplate: appsync.MappingTemplate.fromString(
        requestTemplate(addFriendsEdgeArgs, MutationType.ADD_FRIENDS_EDGE)
      ),
      responseMappingTemplate: appsync.MappingTemplate.fromString(
        responseTemplate()
      ),
    });

    const deleteFriendsEdgeArgs = `\\\"friendsEdgeId\\\": \\\"$ctx.args.friendsEdgeId\\\"`;
    httpEventBridgeDS.createResolver({
      typeName: "Mutation",
      fieldName: MutationType.DELETE_FRIENDS_EDGE,
      requestMappingTemplate: appsync.MappingTemplate.fromString(
        requestTemplate(deleteFriendsEdgeArgs, MutationType.DELETE_FRIENDS_EDGE)
      ),
      responseMappingTemplate: appsync.MappingTemplate.fromString(
        responseTemplate()
      ),
    });

    /* ************************************************************** */
    /* ******** Lambda Function to Resolve AppSync Mutations ******** */
    /* ************************************************************** */
    const appSyncMutationLambda = new lambda.Function(
      this,
      "P15aAppSyncMutationLambda",
      {
        functionName: "p15a-appsync-mutation-lambda",
        runtime: lambda.Runtime.NODEJS_14_X,
        code: lambda.Code.fromAsset("lambdaFns/appSyncMutationLambda"),
        handler: "index.handler",
        memorySize: 1024,
        vpc,
        vpcSubnets: {
          subnetType: ec2.SubnetType.ISOLATED,
        },
        securityGroups: [securityGroup],
        environment: {
          NEPTUNE_READER: cluster.clusterReadEndpoint.socketAddress,
          NEPTUNE_WRITER: cluster.clusterEndpoint.socketAddress,
        },
        timeout: cdk.Duration.seconds(10),
      }
    );

    /* **************************************************************** */
    /* ******** EventBridge Rule to Invoke the Mutation Lambda ******** */
    /* **************************************************************** */
    new events.Rule(this, "P15aEventRule", {
      description:
        "Rule to invoke the mutation lambda when a mutation is run in AppSync",
      eventPattern: {
        source: [EVENT_SOURCE],
        detailType: [
          MutationType.ADD_PERSON,
          MutationType.ADD_UPDATE_FIRST_NAME,
          MutationType.ADD_UPDATE_LAST_NAME,
          MutationType.DELETE_PERSON,
          MutationType.ADD_CITY,
          MutationType.UPDATE_CITY_NAME,
          MutationType.DELETE_CITY,
          MutationType.ADD_STATE,
          MutationType.UPDATE_STATE_NAME,
          MutationType.DELETE_STATE,
          MutationType.ADD_CUISINE,
          MutationType.UPDATE_CUISINE_NAME,
          MutationType.DELETE_CUISINE,
          MutationType.ADD_RESTAURANT,
          MutationType.UPDATE_RESTAURANT_NAME,
          MutationType.UPDATE_RESTAURANT_ADDRESS,
          MutationType.DELETE_RESTAURANT,
          MutationType.ADD_REVIEW,
          MutationType.DELETE_REVIEW,
          MutationType.ADD_REVIEW_RATING,
          MutationType.DELETE_REVIEW_RATING,
          MutationType.ADD_FRIENDS_EDGE,
          MutationType.DELETE_FRIENDS_EDGE,
        ],
      },
      targets: [new eventTargets.LambdaFunction(appSyncMutationLambda)],
    });

    cdk.Tags.of(this).add("Project", "P15A-Dining-By-Friends-Neptune");
  }
}

enum QueryType {
  GET_PERSON = "getPerson",
  GET_FRIENDS = "getFriends",
  GET_FRIENDS_OF_FRIENDS = "getFriendsOfFriends",
  FIND_PATH_BETWEEN_PEOPLE = "findPathBetweenPeople",
  HIGHEST_RATED_RESTAURANT_BY_CUISINE = "highestRatedRestaurantByCuisine",
  HIGHEST_RATED_RESTAURANTS = "highestRatedRestaurants",
  NEWEST_RESTAURANT_REVIEWS = "newestRestaurantReviews",
  RESTAURANTS_BY_FRIENDS_RECOMMENDATION = "restaurantsByFriendsRecommendation",
  RESTAURANTS_BY_FRIENDS_REVIEW_RATINGS = "restaurantsByFriendsReviewRatings",
  RESTAURANTS_RATED_OR_REVIEWED_BY_FRIENDS_IN_X_DAYS = "restaurantsRatedOrReviewedByFriendsinXDays",
  GET_ALL_STATES = "getAllStates",
  GET_ALL_CITIES = "getAllCities",
  GET_ALL_CUISINES = "getAllCuisines",
  GET_ALL_RESTAURANTS = "getAllRestaurants",
  GET_ALL_PERSONS = "getAllPersons",
  GET_ALL_REVIEWS = "getAllReviews",
  GET_ALL_REVIEW_RATINGS = "getAllReviewRatings",
}

enum MutationType {
  ADD_PERSON = "addPerson",
  ADD_UPDATE_FIRST_NAME = "addUpdateFirstName",
  ADD_UPDATE_LAST_NAME = "addUpdateLastName",
  DELETE_PERSON = "deletePerson",
  ADD_CITY = "addCity",
  UPDATE_CITY_NAME = "updateCityName",
  DELETE_CITY = "deleteCity",
  ADD_STATE = "addState",
  UPDATE_STATE_NAME = "updateStateName",
  DELETE_STATE = "deleteState",
  ADD_CUISINE = "addCuisine",
  UPDATE_CUISINE_NAME = "updateCuisineName",
  DELETE_CUISINE = "deleteCuisine",
  ADD_RESTAURANT = "addRestaurant",
  UPDATE_RESTAURANT_NAME = "updateRestaurantName",
  UPDATE_RESTAURANT_ADDRESS = "updateRestaurantAddress",
  DELETE_RESTAURANT = "deleteRestaurant",
  ADD_REVIEW = "addReview",
  DELETE_REVIEW = "deleteReview",
  ADD_REVIEW_RATING = "addReviewRating",
  DELETE_REVIEW_RATING = "deleteReviewRating",
  ADD_FRIENDS_EDGE = "addFriendsEdge",
  DELETE_FRIENDS_EDGE = "deleteFriendsEdge",
}
