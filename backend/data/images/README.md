# Product images

The product JSON records refer to images under `/images/<category>/<filename>`.
Place each image in the matching category folder here, for example:

```text
data/images/laptops/acer-nitro-92-core-i5-laptop-1.jpg
```

The API serves this directory at `/images`. The database contains image paths,
but the image files themselves must also be present here for them to load.
