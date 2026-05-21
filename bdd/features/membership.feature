@regression @membership
Feature: Membership and discount flows

    Scenario: Membership page shows tier benefits and day pass details
        When I am on the membership page
        Then the membership tiers are visible
        And the membership prices are displayed
        And the membership page shows at least one perk description
        And the membership page shows the day pass description

    @smoke
    Scenario: Day pass upsell is shown during guest checkout
        Given I am on the now playing page
        When I select a movie that has scheduled showtimes
        And I pick the first available showtime
        And I continue as guest
        Then the day pass upsell is visible with the correct price

    Scenario: Invalid promo code shows an error
        Given I am on the Food & Drink checkout page
        When I apply promo code "INVALID-CODE-XYZ"
        Then a promo code error is shown
