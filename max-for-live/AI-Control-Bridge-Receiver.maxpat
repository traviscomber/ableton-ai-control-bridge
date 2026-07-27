{
	"patcher" : 	{
		"fileversion" : 1,
		"appversion" : 		{
			"major" : 8,
			"minor" : 0,
			"revision" : 0,
			"architecture" : "x64",
			"modernui" : 1
		}
,
		"classnamespace" : "box",
		"rect" : [ 34.0, 79.0, 820.0, 429.0 ],
		"bglocked" : 0,
		"openinpresentation" : 1,
		"default_fontsize" : 10.0,
		"default_fontface" : 0,
		"default_fontname" : "Arial",
		"gridonset" : 16,
		"gridsize" : 15.0,
		"gridsnaponopen" : 1,
		"objectsnaponopen" : 1,
		"statusbarvisible" : 2,
		"toolbarvisible" : 1,
		"lefttoolbarpinned" : 0,
		"toptoolbarpinned" : 0,
		"righttoolbarpinned" : 0,
		"bottomtoolbarpinned" : 0,
		"toolbarsvisible" : 1,
		"showontaskbar" : 0,
		"parmeditors" : 0,
		"showstatusbar" : 0,
		"boxanimatetime" : 200,
		"enablehscroll" : 1,
		"enablevscroll" : 1,
		"devicename" : "AI Control Bridge Receiver",
		"devicetype" : "midifx",
		"boxes" : [ 		{
			"box" : 			{
				"id" : "obj-8",
				"maxclass" : "comment",
				"text" : "Keep this device loaded in the Live Set while the Python bridge is running at 127.0.0.1:8765",
				"linecount" : 2,
				"patching_rect" : [ 280.0, 145.0, 470.0, 33.0 ],
				"presentation" : 1,
				"presentation_rect" : [ 20.0, 88.0, 520.0, 33.0 ]
			}

		}
, 		{
			"box" : 			{
				"id" : "obj-7",
				"maxclass" : "comment",
				"text" : "UDP commands: 9001 · acknowledgements: 9002",
				"patching_rect" : [ 280.0, 100.0, 380.0, 20.0 ],
				"presentation" : 1,
				"presentation_rect" : [ 20.0, 58.0, 380.0, 20.0 ]
			}

		}
, 		{
			"box" : 			{
				"id" : "obj-6",
				"maxclass" : "comment",
				"text" : "Ableton AI Control Bridge Receiver",
				"fontsize" : 18.0,
				"patching_rect" : [ 280.0, 55.0, 350.0, 27.0 ],
				"presentation" : 1,
				"presentation_rect" : [ 20.0, 18.0, 350.0, 27.0 ]
			}

		}
, 		{
			"box" : 			{
				"id" : "obj-5",
				"maxclass" : "newobj",
				"text" : "print ableton-ai-bridge",
				"patching_rect" : [ 240.0, 245.0, 145.0, 20.0 ]
			}

		}
, 		{
			"box" : 			{
				"id" : "obj-4",
				"maxclass" : "newobj",
				"text" : "udpsend 127.0.0.1 9002",
				"patching_rect" : [ 40.0, 265.0, 165.0, 20.0 ]
			}

		}
, 		{
			"box" : 			{
				"id" : "obj-3",
				"maxclass" : "newobj",
				"text" : "js bridge_receiver.js",
				"patching_rect" : [ 40.0, 215.0, 145.0, 20.0 ]
			}

		}
, 		{
			"box" : 			{
				"id" : "obj-2",
				"maxclass" : "newobj",
				"text" : "dict.deserialize",
				"patching_rect" : [ 40.0, 175.0, 105.0, 20.0 ]
			}

		}
, 		{
			"box" : 			{
				"id" : "obj-1",
				"maxclass" : "newobj",
				"text" : "tosymbol",
				"patching_rect" : [ 40.0, 135.0, 70.0, 20.0 ]
			}

		}
, 		{
			"box" : 			{
				"id" : "obj-11",
				"maxclass" : "newobj",
				"text" : "route /bridge",
				"patching_rect" : [ 40.0, 95.0, 90.0, 20.0 ]
			}

		}
, 		{
			"box" : 			{
				"id" : "obj-10",
				"maxclass" : "newobj",
				"text" : "udpreceive 9001",
				"patching_rect" : [ 40.0, 55.0, 120.0, 20.0 ]
			}

		}
 ],
		"lines" : [ 		{
			"source" : [ "obj-10", 0 ],
			"destination" : [ "obj-11", 0 ]
		}
, 		{
			"source" : [ "obj-11", 0 ],
			"destination" : [ "obj-1", 0 ]
		}
, 		{
			"source" : [ "obj-1", 0 ],
			"destination" : [ "obj-2", 0 ]
		}
, 		{
			"source" : [ "obj-2", 0 ],
			"destination" : [ "obj-3", 0 ]
		}
, 		{
			"source" : [ "obj-3", 0 ],
			"destination" : [ "obj-4", 0 ]
		}
, 		{
			"source" : [ "obj-3", 1 ],
			"destination" : [ "obj-5", 0 ]
		}
 ],
		"metadata" : 		{
			"default_midifx_device" : 1
		}

	}

}
