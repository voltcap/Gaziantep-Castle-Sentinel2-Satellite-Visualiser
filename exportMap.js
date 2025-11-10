var exportButton = ui.Button({
  label: 'Export image',
  onClick: function() {
    var dateString = selector.getValue();
    if (!dateString) {
      print('choose a date');
      return;
    }
    var selectedDate = dateString.slice(0, 10);
    var selectedImage = imageCollection
      .filterDate(selectedDate, ee.Date(selectedDate).advance(1, 'day'))
      .first()
      .select(['B4', 'B3', 'B2'])
      .clip(clipGeometry);
    
    Export.image.toDrive({
      image: selectedImage,
      description: 'Gaziantep_Castle_PHASE_' + selectedDate.replace(/-/g, ''),
      scale: 10,
      region: clipGeometry,
      maxPixels: 1e9
    });
    print('Export completed');
  }
});
controlPanel.add(exportButton);
