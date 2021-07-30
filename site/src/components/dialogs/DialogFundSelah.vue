
<template lang='pug'>

v-card
    v-card-title Fund more apps by us
    v-card-text
        p(class='body-1') We're #[a(href='https://gracious.tech' target='gracious.tech') Gracious Tech], and we make Christian apps that are mission-focused, high quality, secure, and free. We make apps to make Christ known, to help reach all nations with the Gospel.
        p(class='body-1') We are funded by some generous brothers and sisters in Christ, allowing us to offer our apps free of charge to everyone. #[strong We are currently in need of more funding] though to work on our next projects and improve our existing apps.
        p(class='body-1')
            strong Please consider joining us in this work:

        p
            v-btn-toggle(v-model='amount' color='primary')
                v-btn(value='a') ${{ amounts[frequency].a }}
                v-btn(value='b') ${{ amounts[frequency].b }}
                v-btn(value='c') ${{ amounts[frequency].c }}
                v-btn(value='d') ${{ amounts[frequency].d }}
            v-btn-toggle(v-model='frequency' mandatory color='primary')
                v-btn(value='monthly') Monthly
                v-btn(value='single') One-off
            v-btn-toggle(v-model='currency' mandatory color='primary')
                v-btn(value='usd') USD
                v-btn(value='aud') AUD

        p
            | With this support we'll be able to e.g...
            |
            strong {{ applications[frequency][amount] }}

    v-card-actions
        v-btn(@click='dismiss' text color='primary') Dismiss
        v-btn(@click='fund' :disabled='!amount' text color='primary') Support

</template>


<script lang='ts'>

import {Component, Vue} from 'vue-property-decorator'

import app_config from '@/app_config.json'


@Component({})
export default class extends Vue {

    frequency = 'monthly'
    currency = 'usd'
    amount = null  // Make user choose
    amounts = {
        single: {
            a: 50,
            b: 100,
            c: 200,
            d: 500,
        },
        monthly: {
            a: 20,
            b: 40,
            c: 60,
            d: 100,
        },
    }
    applications = {
        single: {
            a: "fix a small issue with an app",
            b: "write one page for a new app",
            c: "design a new app's logo",
            d: "create a new feature for an app",
        },
        monthly: {
            a: "fix a number of issues with an app",
            b: "design the layout of a new app",
            c: "add some new features to an app",
            d: "design the core feature of a new app",
        },
    }
    price_ids = {
        usd: {
            single: {
                a: 'price_1GsX1XDSM4YTEZ815sMKWdtd',
                b: 'price_1GsX1XDSM4YTEZ81SkC1h3Eb',
                c: 'price_1GsX1YDSM4YTEZ81eA6qUwgp',
                d: 'price_1GsX1YDSM4YTEZ81MCMvsOYU',
            },
            monthly: {
                a: 'price_1GsX1XDSM4YTEZ81ebWuAA3E',
                b: 'price_1GsX1XDSM4YTEZ81dJzkxZ8Q',
                c: 'price_1GsX1XDSM4YTEZ81bhvehmtt',
                d: 'price_1GsX1XDSM4YTEZ81uQhjAxI0',
            },
        },
        aud: {
            single: {
                a: 'price_1GsX1YDSM4YTEZ81ye0Ise6s',
                b: 'price_1GsX1YDSM4YTEZ81x6vchp5x',
                c: 'price_1GsX1YDSM4YTEZ81IHns0Hrl',
                d: 'price_1GsX1YDSM4YTEZ81MWMkSgZm',
            },
            monthly: {
                a: 'price_1GsX1YDSM4YTEZ81VQrLKvVx',
                b: 'price_1GsX1YDSM4YTEZ81ZaaX5gPM',
                c: 'price_1GsX1YDSM4YTEZ81yCSmT9dN',
                d: 'price_1GsX1YDSM4YTEZ81TG1uVfVy',
            },
        },
    }

    dismiss(){
        this.$store.dispatch('show_dialog', null)
    }

    fund(){
        // Redirect to Stripe for checkout

        // Setup Stripe object
        const stripe = self.Stripe(app_config.stripe_key_public)

        // Work out which price id to use
        const price_id = this.price_ids[this.currency][this.frequency][this.amount]

        // Redirect to checkout page
        stripe.redirectToCheckout({
            mode: this.frequency === 'single' ? 'payment' : 'subscription',
            lineItems: [{price: price_id, quantity: 1}],
            submitType: 'donate',  // Text for button when not a subscription
            // Whether cancel or pay, return to page was just on
            successUrl: self.location.href,
            cancelUrl: self.location.href,
        }).then(function(result){
            if (result.error){
                // Most likely a network error so tell user to try again
                this.$store.dispatch('show_notification', "Couldn't connect, please try again")
            }
        })
    }

}

</script>


<style lang='sass' scoped>


.v-item-group
    margin-right: 12px
    margin-bottom: 12px


</style>
