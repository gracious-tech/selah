
<template lang='pug'>

//- Use v-if as well so not in DOM when not needed
//- NOTE Can't use v-model as need to pass on event rather than set value in this component
v-dialog(v-if='value' :value='value' @input='$emit("input", $event)')
    v-card
        v-card-title Contact Us
        v-card-text
            p(class='body-1') Please let us know if you have any questions or suggestions for this app.
            v-textarea(v-model='feedback' label="Message" required)
            v-text-field(v-model='email' label="Email address (optional)" persistent-hint
                hint="Please give an email address if you'd like a response from us")
        v-card-actions
            v-btn(@click='$emit("input", false)' text color='primary') Cancel
            v-btn(@click='send' :disabled='!feedback.trim()' text color='primary') Send

</template>


<script lang='ts'>

import {Component, Vue, Prop} from 'vue-property-decorator'


@Component({})
export default class extends Vue {

    feedback = ''
    email = ''

    @Prop() value

    send(){
        // Send feedback to admin
        this.$store.dispatch('client_feedback', {feedback: this.feedback, email: this.email})
        // Close dialog
        this.$emit('input', false)
        // Show notification to assure user message has been received (hopefully!)
        this.$store.dispatch('show_notification', "Thanks for your message")
        // Reset message field (but not email field)
        this.feedback = ''
    }

}

</script>


<style lang='sass' scoped>


</style>
