
<template lang='pug'>

div.root

    //- NOTE Very unique class so can identify .chat-messages outside of this component
    div.chat-messages(ref='messages')
        p(class='caption text--secondary') Messages are private and encrypted. Guests cannot see messages sent before they joined.
        route-room-chat-message(v-for='msg of messages' :msg='msg' :key='msg.id')

    //- Only capture plain enter, so newlines can still be entered with shift+enter
    v-textarea(v-model='draft' @keydown.enter.exact.prevent='send' :disabled='deny_chat'
            outlined auto-grow hide-details rows='1' :placeholder='placeholder')
        template(#append)
            v-btn(@click='send' :disabled='!draft_cleaned' icon)
                app-svg(name='icon_send')

</template>


<script lang='ts'>

import {Component, Vue, Watch} from 'vue-property-decorator'

import RouteRoomChatMessage from './RouteRoomChatMessage.vue'


@Component({
    components: {RouteRoomChatMessage},
})
export default class extends Vue {

    draft = ''

    mounted(){
        // Scroll to bottom of messages when first render
        const container = (this.$refs.messages as HTMLElement)
        container.scrollTo(0, container.scrollHeight)
    }

    get deny_chat(){
        return this.$store.getters.deny_chat
    }

    get draft_cleaned(){
        return this.draft.trim()
    }

    get messages(){
        return this.$store.state.tmp.room_messages
    }

    get placeholder(){
        return this.deny_chat ? "Admins only" : "Send message..."
    }

    @Watch('messages') watch_messages(){
        // If near bottom of messages, scroll to bottom when receive new message
        const container = (this.$refs.messages as HTMLElement)
        const bottom_of_viewable = container.scrollTop + container.clientHeight
        const remaining_till_end = container.scrollHeight - bottom_of_viewable
        if (remaining_till_end < 300){  // NOTE one single-line message ~= 100px
            this.$nextTick(() => {
                container.scrollTo(0, container.scrollHeight)
            })
        }
    }

    send(){
        // This may be triggered by enter, so can't assume draft has a value
        if (this.draft_cleaned){
            this.$store.dispatch('room_message_send', this.draft_cleaned)
            this.draft = ''
        }
    }

}

</script>


<style lang='sass' scoped>

.chat-messages
    // Make messages section grow to push send field to bottom BUT scroll when overflow
    flex-grow: 1
    display: flex
    flex-direction: column
    overflow-y: auto
    padding: 12px

    ::v-deep strong
        // Use actual bold rather than 500 for <strong> in messages
        font-weight: bold


.v-textarea
    flex-grow: 0  // Don't compete with .chat-messages
    flex-shrink: 0  // Don't shrink either (ios requires, others don't seem to)
    margin: 12px

    ::v-deep textarea
        max-height: 24px * 4  // Max rows
        overflow: auto  // Overflow when hit max rows


// Fix alignment of send button
::v-deep .v-input__append-inner
    margin-top: 10px


</style>
