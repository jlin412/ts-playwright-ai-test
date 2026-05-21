@regression @purchase @critical
Feature: Movie ticket purchase

    @smoke
    Scenario: Selecting a showtime navigates to the checkout page with all tabs
        Given I am on the now playing page
        When I select a movie that has scheduled showtimes
        And I pick the first available showtime
        Then I land on the checkout showing page
        And the checkout page shows the four tabs Tickets, Food & Drink, Cart, and Payment
        And the checkout page offers a guest checkout option

    @smoke
    Scenario: Guest can add multiple tickets and advance to Food & Drink
        Given I am on the now playing page
        When I select a movie that has scheduled showtimes
        And I pick the first available showtime
        And I continue as guest
        And I add the first ticket type to my cart
        Then the cart summary shows 1 ticket
        When I add the first ticket type to my cart
        Then the cart summary shows 2 tickets
        When I advance to Food & Drink
        Then I land on the Food & Drink page
        And the Food & Drink page cart summary still shows 2 tickets
