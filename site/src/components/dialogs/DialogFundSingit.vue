
<template lang='pug'>

v-card
    v-card-title Pay whatever you like
    v-card-text
        p(class='body-1') We made this app to help people during COVID, so you can pay whatever you like to use it. Your support will help to cover our costs and fund improvements, and you'll have unlimited access for 1 year.

        p
            v-slider(v-model='dollars' min='1' max='100' thumb-label='always' label='$ USD')

        v-expansion-panels(flat)
            v-expansion-panel
                v-expansion-panel-header(class='text--secondary') Already paid?
                v-expansion-panel-content
                    v-text-field(v-model='email' label="Email address" persistent-hint
                            hint="Submit your email address to confirm you have paid before")
                        template(#append-outer)
                            v-btn(@click='confirm_paid' :disabled='!email.includes("@")' text
                                color='primary') Submit

    v-card-actions
        v-btn(@click='dismiss' text color='primary') Later
        v-btn(@click='fund' text color='primary') Support

</template>


<script lang='ts'>

import {Component, Vue} from 'vue-property-decorator'


@Component({})
export default class extends Vue {

    dollars = 18
    email = ''

    dismiss(){
        this.$store.dispatch('show_dialog', null)
    }

    fund(){
        // Create checkout session (handler of response will redirect to checkout)
        // NOTE Amount must be in cents
        this.$store.dispatch('fund_singit_session', this.dollars * 100)
    }

    confirm_paid(){
        // Confirm if user has already paid
        // TODO Currently not implemented (unknown to user)
        this.$store.commit('dict_set', ['singit_paid', true])
        this.$store.dispatch('show_notification', "Thank you for confirming")
        this.dismiss()
    }

}

</script>


<style lang='sass' scoped>


.v-input__slider
    margin-top: 50px  // Stop thumb label appearing over text above

::v-deep .v-slider__thumb-label
    color: $on_primary  // Stand out on primary color


</style>
