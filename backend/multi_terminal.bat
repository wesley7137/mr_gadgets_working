@echo off
start wt ^
 new-tab -d "C:\Users\wesla\my-awesome-app\backend" cmd ; ^
 split-pane -V -d "C:\Users\wesla\my-awesome-app" cmd ; ^
 move-focus left ; ^
 split-pane -H -d "C:\Users\wesla\my-awesome-app\backend" cmd ; ^
 move-focus up ; ^
 move-focus right ; ^
 split-pane -H -d "C:\Users\wesla\my-awesome-app" cmd