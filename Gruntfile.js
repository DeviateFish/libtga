'use strict';
var LIVERELOAD_PORT = 35729;
var lrSnippet = require('connect-livereload')({port: LIVERELOAD_PORT});
var mountFolder = function (connect, dir) {
  return connect.static(require('path').resolve(dir));
};

module.exports = function(grunt) {
  require('time-grunt')(grunt);
  require('load-grunt-tasks')(grunt);

  grunt.initConfig({

    pkg: grunt.file.readJSON('package.json'),

    babel: {
      options: {
        sourceMap: true,
        modules: 'umd'
      },
      dist: {
        files: {
          'dist/libtga.js': 'src/libtga.js'
        }
      }
    },

    uglify: {
      options: {
        banner: '/*! libtga <%= grunt.template.today("dd-mm-yyyy") %> */\n',
        sourceMap: true
      },
      dist: {
        files: {
          'dist/libtga.min.js': ['dist/libtga.js']
        }
      }
    },

    jshint: {
      files: ['src/libtga.js'],
      options: {
        globals: {
        },
        jshintrc: '.jshintrc'
      }
    },

    watch: {
      options: {
        nospawn: true,
        livereload: { liveCSS: false }
      },
      livereload: {
        options: {
          livereload: true
        },
        files: [
          './demo/**/*',
          './dist/libtga.js'
        ]
      },
      js: {
        files: ['./src/libtga.js'],
        tasks: ['build']
      }
    },
    connect: {
      options: {
        port: 9005,
        // change this to '0.0.0.0' to access the server from outside
        hostname: '0.0.0.0'
      },
      livereload: {
        options: {
          middleware: function (connect) {
            return [
              lrSnippet,
              mountFolder(connect, './'),
            ];
          }
        }
      }
    }

  });

  grunt.registerTask('serve', function (target) {
    grunt.task.run([
      'connect:livereload',
      'watch'
    ]);
  });

  grunt.registerTask('build', [
    'jshint',
    'babel',
    'uglify'
  ]);

  grunt.registerTask('default', [
    'build',
    'serve'
  ]);
};
