date_default_timezone_set('Australia/Sydney');

$helper = init_cbhelper();
$output = $helper->search_document("events", array());

foreach($output["message"] as $evt) {  
  $format = ($evt["eventScheduleType"] == "weekly" ? 'w' : 'd');
  $obj = array("date"=>date("Y-m-d", time()), "amount"=>$evt["amount"], "id"=>uniqid());
  
  if(date($format, time()) == $evt["eventScheduleOption"]) {
    if(array_key_exists("description", $evt)) {
      $obj["description"] = $evt["description"];
    }
    if(array_key_exists("tags", $evt)) {
      $obj["tags"] = $evt["tags"];
    }
    $helper->insert_document($obj, $evt["eventType"]);
  }
}

return "success";