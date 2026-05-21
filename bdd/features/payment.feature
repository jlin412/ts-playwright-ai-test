@regression @checkout
Feature: Payment form validation

    Background:
        Given I am on the payment page as a guest with one ticket in cart

    @smoke
    Scenario: PAY button is disabled before the form is completed
        Then the PAY button is disabled

    Scenario: Invalid email format shows an inline error
        When I enter an invalid email "notanemail"
        Then an email validation error is shown

    Scenario: Past expiry date marks the Stripe expiry field invalid
        When I fill the Stripe expiry with a past date "01 / 20"
        Then the expiry field shows as invalid

    Scenario: Incomplete CVC marks the Stripe CVC field invalid
        When I fill the Stripe expiry with a past date "12 / 30"
        And I fill the Stripe CVC with incomplete digits "1"
        Then the CVC field shows as invalid
