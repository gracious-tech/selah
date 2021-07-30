
<template lang='pug'>

v-dialog(:value='show' @input='on_close' :fullscreen='fullscreen' scrollable)
    component(:is='dialog')

</template>


<script lang='ts'>

import {Component, Vue, Watch} from 'vue-property-decorator'

import DialogFundSelah from './DialogFundSelah.vue'
import DialogFundSingit from './DialogFundSingit.vue'


@Component({
    components: {DialogFundSelah, DialogFundSingit},
})
export default class extends Vue {

    show = false
    dialog = null

    get fullscreen(){
        // Return whether dialog should take up whole screen or leave border
        return this.$store.state.tmp.viewport_width < 500
    }

    @Watch('$store.state.tmp.dialog') watch_dialog(value){
        // Handle change or removal of dialog to show
        this.show = !!value
        if (this.show){
            // Showing a new dialog so switch straight away
            this.dialog = value
        } else {
            // Closing an existing dialog so delay to allow closing animation
            setTimeout(() => {
                this.dialog = value
            }, 500)
        }
    }

    on_close(){
        this.$store.commit('tmp_set', ['dialog', null])
    }

}

</script>


<style lang='sass' scoped>


</style>
