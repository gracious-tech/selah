
<template lang='pug'>

div.msg(:class='client_class')
    div.header
        div.name {{ name }}
        div.time(:title='msg.timestamp|date') {{ msg.timestamp|time }}
    div.text(v-html='msg.html')
    div.btn
        v-btn(v-if='msg.button' @click='action' color='accent' small) {{ msg.button.text }}

</template>


<script lang='ts'>

import {Component, Vue, Prop} from 'vue-property-decorator'

import app_config from '@/app_config.json'


@Component({
    filters: {

        time: timestamp => {
            // Output hours/minutes/-m in user's locale (preferring am/pm since defaults to 24h)
            const time = new Date(timestamp * 1000).toLocaleTimeString(undefined, {hour12: true})
            // Remove seconds from time (and try to avoid ruining other locales)
            const parts = time.split(':')
            if (parts.length !== 3){
                return time
            }
            return parts[0] + ':' + parts[1] + parts[2].substr(2)  // Assuming seconds is 2 digits!
        },

        date: timestamp => {
            // Output date in user's locale (without time)
            return new Date(timestamp * 1000).toLocaleDateString()
        },

    },
})
export default class extends Vue {

    @Prop() msg

    get system(){
        // Return whether message is from system
        return this.msg.sender === null
    }

    get you(){
        // Return whether message is from self
        return this.$store.state.tmp.own_sockets.includes(this.msg.sender)
    }

    get name(){
        // Return name from clients data if client currently in room, else fallback on msg's name
        // WARN clients list may not be available or limited, which is why msgs also include name
        if (this.you){
            return  // Own message so name not displayed
        } else if (this.system){
            return app_config.name  // A user could fake this, but can't fake the unique background
        } else if (this.$store.getters.client_names[this.msg.sender]){
            // Client is in room so can use intelligent naming (socket chars only if needed)
            return this.$store.getters.client_names[this.msg.sender]
        }
        // Client left room, so just use recorded name and socket chars to ensure distinguished
        return this.msg.name + ` (${this.msg.sender.substr(3, 4)})`
    }

    get client_class(){
        // Return client class (for styling) for the message

        // If self, give special `you` class
        if (this.you){
            return 'you'
        } else if (this.system){
            return 'system'
        }

        // If already assigned a class, use that
        if (this.msg.sender in this.$store.state.tmp.client_classes){
            return this.$store.state.tmp.client_classes[this.msg.sender]
        }

        // Assign the client a class and also return it
        // NOTE getters shouldn't usually have side-effects, but this case merely a form of caching
        const num_classes = 18  // Styles must exist up to this-1 (see below)
        const next = this.$store.state.tmp.client_classes_next
        const value = 'client' + next % num_classes
        this.$store.commit('tmp_new', ['client_classes', this.msg.sender, value])
        this.$store.commit('tmp_set', ['client_classes_next', next + 1])
        return value
    }

    action(){
        this.$store.dispatch(this.msg.button.action)
    }

}

</script>


<style lang='sass' scoped>

.msg
    align-self: flex-start
    min-width: 150px
    max-width: 80%
    padding: 6px 12px
    margin-bottom: 12px
    border-radius: 6px
    font-size: 14px
    @include themed(background-color, #0001, #fff1)

    .header
        display: flex

    .name
        font-weight: 500
        font-size: 12px
        margin-right: 12px  // Don't touch time

    .time
        flex-grow: 1  // Must grow time to keep right aligned (name won't exist if own message)
        opacity: 0.7
        font-size: 12px
        text-align: right

    &.system
        background-color: rgba($accent, 0.25)

        .name
            opacity: 0.5

    &.you
        align-self: flex-end
        background-color: rgba($primary, 0.25)

        .name
            display: none

    .btn
        text-align: center
        margin: 12px 0


// Unique colors for names of different clients
// Assign most distinguishable colors first
// TODO theme support
.client0 .name
    color: map-get($red, lighten-2)
.client1 .name
    color: map-get($purple, lighten-2)
.client2 .name
    color: map-get($indigo, lighten-2)
.client3 .name
    color: map-get($blue, lighten-2)
.client4 .name
    color: map-get($cyan, lighten-2)
.client5 .name
    color: map-get($green, lighten-2)
.client6 .name
    color: map-get($yellow, lighten-2)
.client7 .name
    color: map-get($orange, lighten-2)
.client8 .name
    color: map-get($brown, lighten-2)
// If lots of clients, start using these other more similar colors
.client9 .name
    color: map-get($deep-orange, lighten-2)
.client10 .name
    color: map-get($amber, lighten-2)
.client11 .name
    color: map-get($lime, lighten-2)
.client12 .name
    color: map-get($light-green, lighten-2)
.client13 .name
    color: map-get($teal, lighten-2)
.client14 .name
    color: map-get($deep-purple, lighten-2)
.client15 .name
    color: map-get($pink, lighten-2)
.client16 .name
    color: map-get($light-blue, lighten-2)
.client17 .name
    color: map-get($blue-grey, lighten-2)

</style>
