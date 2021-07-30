
<template lang='pug'>

div.root(v-if='!$store.state.name' class='accent')
    v-text-field(v-model='name' @keydown.enter='set_name' dense hide-details spellcheck='false'
            placeholder="Enter your name (so friends can see you)")
        template(#append)
            v-btn(@click='set_name' :disabled='!name_cleaned' icon)
                app-svg(name='icon_done')

</template>


<script lang='ts'>

import {Component, Vue} from 'vue-property-decorator'


@Component({})
export default class extends Vue {

    name = ''

    get name_cleaned(){
        return this.name.trim()
    }

    set_name(){
        // This may be triggered by enter, so can't assume disabled when value empty
        if (this.name_cleaned){
            this.$store.dispatch('client_name', this.name_cleaned)
        }
    }

}

</script>


<style lang='sass' scoped>


.root
    padding: 6px 12px 12px 12px


::v-deep input::placeholder
    // Make a little clearer since on accent background
    color: rgba(white, 0.8) !important


</style>
