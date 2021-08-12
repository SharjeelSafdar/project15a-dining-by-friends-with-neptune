<h1 align="center">
  Project 15A: Dining By Friends GraphQL API with Event-Driven Architecture
</h1>

This AWS CDK App deploys the backend infrastructure for the Dining by Friends GraphQL API to AWS CloudFormation. It consists of the following constructs:

- A [Cognito](https://aws.amazon.com/cognito/) [User Pool](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-identity-pools.html) for authenticating users
- An [Amazon VPC](https://aws.amazon.com/vpc/) with 2 Private Subnets and a Security Group to create the database in
- An [Amazon Neptune](https://aws.amazon.com/neptune/) graph database to store the data for the api
- A [Lambda](https://aws.amazon.com/lambda/) function to add a new user's data to the database when he/she confirms his/her email after signing up
- An [AppSync](https://aws.amazon.com/appsync/) GraphQL API to get data from or update the data in the database
- A Lambda function connected to a Lambda Data Source of AppSync to synchronously read data from Neptune DB
- An HTTP Data Source of AppSync to put the mutation data on the default [EventBridge](https://aws.amazon.com/eventbridge/) bus
- A Lambda function to perform the mutation on the Neptune DB asynchronously
- An EventBridge rule to envoke the lambda function to perform the mutation

<p align="center">
  <img alt="Architecture Diagram" src="./P15a AWS Architecture.jpg" />
</p>
