<?php
  // Make a simple demo of an on/off switch 
 
  $word=explode(" ",$_REQUEST['cmd']);
  if(isset($word[1]) && $word[1]=='on')
    echo '<div id="'.$word[0].'" class="on" onclick="cmd(this.id,this.id + \' off\');">ON</div>';
  elseif(isset($word[1]) && $word[1]=='off')  
    echo '<div id="'.$word[0].'" class="off" onclick="cmd(this.id,this.id + \' on\');">OFF</div>';
  else
    echo '<div id="script_output">Nice command: <strong>'.$_REQUEST['cmd'] .'</strong> Give me another one!</div>';
  
?>
