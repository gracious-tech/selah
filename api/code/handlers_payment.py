
from urllib.parse import urlparse, urlencode, urlunparse, parse_qsl


class HandlersPayment:
    """Handlers for payments"""


    def handle_payment_session(self):
        """Generate a new payment session with the given amount"""

        # This handler is only applicable to Singit
        domain = self.config['domain']
        if domain != 'singit.cloud':
            self.client_error("Handler not implemented")

        # Input
        amount, return_url = self.expect(['payment_amount', 'payment_return_url'])
        if amount < 100:
            self.client_error("Amount cannot be less than 100 cents")
        try:
            url_parts = urlparse(return_url)
        except:
            self.client_error("URL not valid")

        # Create success url
        params = parse_qsl(url_parts.query)
        params.append(('paid', ''))
        success_url_parts = list(url_parts)
        success_url_parts[4] = urlencode(params)
        success_url = urlunparse(success_url_parts)

        # Setup stripe
        import stripe
        stripe.api_key = self.config['secrets']['stripe_key_private']

        # Create a new checkout session
        resp = stripe.checkout.Session.create(
            mode='payment',
            payment_method_types=['card'],
            cancel_url=return_url,
            success_url=success_url,
            submit_type='pay',
            line_items=[{
                'quantity': 1,
                'price_data': {
                    'currency': 'usd',
                    'unit_amount': amount,  # NOTE In cents!
                    'product_data': {
                        'name': "Support for Singit Cloud",
                    },
                },
            }],
        )

        # Reply with the checkout session id
        self.reply('payment_session', resp['id'])


    def handle_payment_paid(self):
        """Report whether user with given email address has paid something before

        NOTE No email validation included, so risks are:
            1. Can use someone else's address (who has paid) to gain access (avoid payment)
            2. Can identify if another user has paid or not (privacy issue)
            These aren't deemed significant enough to address

        """

        # This handler is only applicable to Singit
        if self.config['domain'] != 'singit.cloud':
            self.client_error("Handler not implemented")

        # Input
        email = self.expect(['client_email'])

        # Setup stripe
        import stripe
        stripe.api_key = self.config['secrets']['stripe_key_private']

        # Try get customer with given email address who has paid something
        customers = stripe.Customer.list(email=email)
        for customer in customers['data']:
            charges = stripe.Charge.list(customer=customer['id'])
            for charge in charges['data']:
                if charge['status'] == 'succeeded':
                    self.reply('payment_paid', True)
                    return

        # Didn't find a charge so return false
        self.reply('payment_paid', False)
