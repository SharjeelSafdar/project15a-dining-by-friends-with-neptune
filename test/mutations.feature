Feature: DiningByFriends GraphQL API Mutations Tests
Background:
  * url 'https://hyqc2zqqrfbqdjm54stk6aetsq.appsync-api.us-east-2.amazonaws.com/graphql'
  * header x-api-key = 'da2-k54eqwmr4ve73omwv5j6xo5tyq'

  Scenario: Add a New State Mutation
    * text query = 
      """
        mutation MyMutation {
          addState(name: "TestState") {
            result
          }
        }
      """
    Given request { query: '#(query)' }
    When method post
    Then status 200
    * match response == "#object"
    * match response.errors == '#notpresent'
    * match response.data == { addState: "#notnull" }
    * match response.data == { addState: "#object" }
    * match response.data.addState == { result: "#string" }
    * print response
