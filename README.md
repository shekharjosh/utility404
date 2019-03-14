## This utility is made to find out the 404 error pages and images greater then 100 kb on the site. Steps to follow to run this utility.

1. Download the package from git.
2. Run - npm i
3. On terminal run command - npm start <site_map_xml_url> [<min_image_size_in_KB (Default to 100000Bytes)>] [<viewport_width_in_digit (Default to 375)> ] [<viewport_hight_in_digit (Default to 676)>]
4. On complete two files are saved. One for 404 error (statusFile.txt) and other for images (imageFile.csv)