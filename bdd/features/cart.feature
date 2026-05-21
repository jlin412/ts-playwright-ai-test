@regression @cart
Feature: Cart validation

    Background:
        Given I am on the now playing page
        When I select a movie that has scheduled showtimes
        And I pick the first available showtime
        And I continue as guest

    @smoke
    Scenario: Cart grand total equals the sum of line totals
        When I add the first ticket type to my cart
        Then the cart summary shows 1 ticket
        When I advance to Food & Drink
        And I advance to Cart
        Then I land on the cart page
        And the grand total equals the sum of the line totals

    Scenario: Cart summary reactively updates when a ticket is added
        When I add the first ticket type to my cart
        Then the cart summary shows 1 ticket
        When I add the first ticket type to my cart
        Then the cart summary shows 2 tickets

    Scenario: Reloading the cart page clears it and redirects home
        When I add the first ticket type to my cart
        And I advance to Food & Drink
        And I advance to Cart
        Then I land on the cart page
        When I reload the cart page
        Then I am redirected to the home page
        And the cart is empty
