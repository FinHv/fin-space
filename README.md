add in ngbot.vars:

```
set variables(TSM)         		    "%release %relsize %incfree %destdir %destfree %destname"
set variables(TSD)         		    "%release %relsize %destdir %destname"
set variables(TDELA)         	    "%release %relsize %destname"
```

add in ngbot.conf:
where $archivechan is defined in here:
```
set archivechan				"#ninja-archive"
```
```
set redirect(TSD)               	$archivechan
set redirect(TDELA)               	$archivechan
set redirect(TSM)               	$archivechan
```
add in the theme file:
```
## TSD
announce.TSM                    		= "%c1{%b{[ARCHiViNG]:}} %c2{[MOViNG]} :: %c2{%b{%release}} :: %c1{%b{[%relsize MB]}} %c1{to} %c3{%b{[ARCHiVE-%destname]}}"
announce.TSD                    		= "%c1{%b{[SPACE]:}} %c2{[DELETE]} :: %c2{%b{%release}} :: %c1{%b{[%relsize MB]}} %c1{from} %c3{%b{[%destname]}}"
announce.TDELA                    		= "%c1{%b{[SPACE]:}} %c2{[DELETE]} :: %c2{%b{%release}} :: %c1{%b{[%relsize MB]}} %c1{from} %c3{%b{[ARCHiVE-%destname]}}"
```

looks like this:
```
<@NiNJA> [ARCHiViNG]: [MOViNG] :: Boardwalk.Empire.S01E02.1080p.BluRay.H264-RMX :: [11772 MB] to [ARCHiVE-TV-HDRiP]
<@NiNJA> [ARCHiViNG]: [MOViNG] :: Boardwalk.Empire.S01E03.1080p.BluRay.H264-RMX :: [9091 MB] to [ARCHiVE-TV-HDRiP]
<@NiNJA> [SPACE]: [DELETE] :: A.Different.Man.2024.MULTi.1080p.BluRay.x264-UKDHD :: [14718 MB] from [ARCHiVE-X264-HD-1080P]
<@NiNJA> [SPACE]: [DELETE] :: Marvels.Spider-Man.2-RUNE :: [96178 MB] from [GAMES]
```

